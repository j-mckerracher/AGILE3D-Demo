#!/usr/bin/env bash
# aws-setup-commands.sh — Create AWS infrastructure for AGILE3D-Demo
# Minimal cost: S3 + CloudFront + OAC + policies only
# No IAM User (manual upload)

set -euo pipefail

# ============================================================================
# 1. Set variables
# ============================================================================
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1
PROJECT=agile3d-demo
BUCKET="${PROJECT}-sequences-${ACCOUNT_ID}-${AWS_REGION}"
VERCEL_ORIGIN="https://agile3d-demo.vercel.app"  # Update with your Vercel URL (no trailing slash)
LOCAL_DEV_ORIGIN="http://localhost:4200"
PRICE_CLASS="PriceClass_100"
TS=$(date +%Y%m%d-%H%M%S)

echo "Account ID: $ACCOUNT_ID"
echo "Bucket: $BUCKET"
echo "Region: $AWS_REGION"
echo ""

# ============================================================================
# 2. Create S3 bucket (private, encrypted, block public)
# ============================================================================
echo "Creating S3 bucket..."
if [ "$AWS_REGION" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "$BUCKET" 2>/dev/null || echo "Bucket already exists"
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION" \
    --create-bucket-configuration LocationConstraint="$AWS_REGION" 2>/dev/null || echo "Bucket already exists"
fi

echo "Blocking public access..."
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration '{"BlockPublicAcls":true,"IgnorePublicAcls":true,"BlockPublicPolicy":true,"RestrictPublicBuckets":true}'

echo "Enabling encryption..."
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# ============================================================================
# 3. Configure S3 CORS
# ============================================================================
echo "Configuring CORS..."
cat > /tmp/s3-cors.json <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "${VERCEL_ORIGIN}",
        "${LOCAL_DEV_ORIGIN}"
      ],
      "AllowedMethods": ["GET","HEAD"],
      "AllowedHeaders": ["Range","Content-Type","Origin","Access-Control-Request-Headers","Access-Control-Request-Method"],
      "ExposeHeaders": ["Accept-Ranges","Content-Length","Content-Range"],
      "MaxAgeSeconds": 600
    }
  ]
}
EOF
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration file:///tmp/s3-cors.json

# ============================================================================
# 4. Create CloudFront OAC (or use existing)
# ============================================================================
echo "Checking for existing CloudFront OAC..."
OAC_ID=$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='AGILE3D-OAC'].Id" --output text 2>/dev/null || true)
if [ -z "$OAC_ID" ]; then
  echo "Creating CloudFront OAC..."
  OAC_ID=$(aws cloudfront create-origin-access-control \
    --origin-access-control-config 'Name=AGILE3D-OAC,Description=OAC for AGILE3D S3 origin,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3' \
    --query 'OriginAccessControl.Id' --output text)
fi
echo "OAC ID: $OAC_ID"

# ============================================================================
# 5. Create CloudFront Response Headers Policy (CORS + Range)
# ============================================================================
echo "Checking for existing Response Headers Policy..."
RHP_ID=$(aws cloudfront list-response-headers-policies --query "ResponseHeadersPolicyList.Items[?ResponseHeadersPolicyConfig.Name=='AGILE3D-CORS-Expose-Range'].Id" --output text 2>/dev/null || true)
if [ -z "$RHP_ID" ]; then
  echo "Creating CloudFront Response Headers Policy..."
cat > /tmp/cf-response-headers-policy.json << 'EOFPOLICY'
{
  "Name": "AGILE3D-CORS-Expose-Range",
  "Comment": "CORS for Vercel + localhost; expose Range-related headers",
  "CorsConfig": {
    "AccessControlAllowOrigins": {
      "Quantity": 2,
      "Items": ["https://agile3d-demo.vercel.app","http://localhost:4200"]
    },
    "AccessControlAllowHeaders": {
      "Quantity": 2,
      "Items": ["range","content-type"]
    },
    "AccessControlAllowMethods": {
      "Quantity": 2,
      "Items": ["GET","HEAD"]
    },
    "AccessControlExposeHeaders": {
      "Quantity": 3,
      "Items": ["Accept-Ranges","Content-Length","Content-Range"]
    },
    "AccessControlAllowCredentials": false,
    "AccessControlMaxAgeSec": 600,
    "OriginOverride": true
  }
}
EOFPOLICY
  RHP_ID=$(aws cloudfront create-response-headers-policy \
    --response-headers-policy-config file:///tmp/cf-response-headers-policy.json \
    --query 'ResponseHeadersPolicy.Id' --output text)
fi
echo "Response Headers Policy ID: $RHP_ID"

# ============================================================================
# 6. Create CloudFront Origin Request Policy
# ============================================================================
echo "Checking for existing Origin Request Policy..."
ORP_ID=$(aws cloudfront list-origin-request-policies --query "OriginRequestPolicyList.Items[?OriginRequestPolicyConfig.Name=='AGILE3D-CORS-Range'].Id" --output text 2>/dev/null || true)
if [ -z "$ORP_ID" ]; then
  echo "Creating CloudFront Origin Request Policy..."
cat > /tmp/cf-origin-request-policy.json <<EOF
{
  "Name": "AGILE3D-CORS-Range",
  "Comment": "Forward Origin, Access-Control-Request-* and Range to S3",
  "HeadersConfig": {
    "HeaderBehavior": "whitelist",
    "Headers": {
      "Quantity": 4,
      "Items": ["Origin","Access-Control-Request-Method","Access-Control-Request-Headers","Range"]
    }
  },
  "CookiesConfig": {"CookieBehavior": "none"},
  "QueryStringsConfig": {"QueryStringBehavior": "none"}
}
EOF
  ORP_ID=$(aws cloudfront create-origin-request-policy \
    --origin-request-policy-config file:///tmp/cf-origin-request-policy.json \
    --query 'OriginRequestPolicy.Id' --output text)
fi
echo "Origin Request Policy ID: $ORP_ID"

# ============================================================================
# 7. Create CloudFront Cache Policy
# ============================================================================
echo "Checking for existing Cache Policy..."
DEFAULT_CACHE_POLICY_ID=$(aws cloudfront list-cache-policies --query "CachePolicyList.Items[?CachePolicyConfig.Name=='AGILE3D-Default-300s'].Id" --output text 2>/dev/null || true)
if [ -z "$DEFAULT_CACHE_POLICY_ID" ]; then
  echo "Creating CloudFront Cache Policy..."
cat > /tmp/cf-cache-policy-default.json <<EOF
{
  "Name": "AGILE3D-Default-300s",
  "Comment": "Default TTL 300s; respect origin Cache-Control up to MaxTTL",
  "DefaultTTL": 300,
  "MaxTTL": 31536000,
  "MinTTL": 0,
  "ParametersInCacheKeyAndForwardedToOrigin": {
    "EnableAcceptEncodingGzip": true,
    "EnableAcceptEncodingBrotli": true,
    "HeadersConfig": {"HeaderBehavior": "none"},
    "CookiesConfig": {"CookieBehavior": "none"},
    "QueryStringsConfig": {"QueryStringBehavior": "none"}
  }
}
EOF
  DEFAULT_CACHE_POLICY_ID=$(aws cloudfront create-cache-policy \
    --cache-policy-config file:///tmp/cf-cache-policy-default.json \
    --query 'CachePolicy.Id' --output text)
fi
echo "Cache Policy ID: $DEFAULT_CACHE_POLICY_ID"

# ============================================================================
# 8. Create CloudFront Distribution
# ============================================================================
echo "Creating CloudFront Distribution..."
cat > /tmp/cloudfront-distribution.json <<EOF
{
  "CallerReference": "agile3d-${TS}",
  "Comment": "AGILE3D-Demo minimal-cost (S3+CF OAC)",
  "Enabled": true,
  "PriceClass": "${PRICE_CLASS}",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "s3origin",
        "DomainName": "${BUCKET}.s3.amazonaws.com",
        "S3OriginConfig": {"OriginAccessIdentity": ""},
        "OriginAccessControlId": "${OAC_ID}"
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 3,
      "Items": ["GET","HEAD","OPTIONS"],
      "CachedMethods": {"Quantity": 3, "Items": ["GET","HEAD","OPTIONS"]}
    },
    "Compress": true,
    "CachePolicyId": "${DEFAULT_CACHE_POLICY_ID}",
    "OriginRequestPolicyId": "${ORP_ID}",
    "ResponseHeadersPolicyId": "${RHP_ID}"
  },
  "Restrictions": {"GeoRestriction": {"RestrictionType": "none", "Quantity": 0}},
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true,
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "HttpVersion": "http2",
  "IsIPV6Enabled": true
}
EOF

CF_OUT=$(aws cloudfront create-distribution --distribution-config file:///tmp/cloudfront-distribution.json)
DIST_ID=$(echo "$CF_OUT" | jq -r '.Distribution.Id')
CF_DOMAIN=$(echo "$CF_OUT" | jq -r '.Distribution.DomainName')
echo "CloudFront Distribution ID: $DIST_ID"
echo "CloudFront Domain: $CF_DOMAIN"

# ============================================================================
# 9. Attach S3 bucket policy (allow only this CloudFront distribution)
# ============================================================================
echo "Attaching S3 bucket policy..."
cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontReadViaOAC",
      "Effect": "Allow",
      "Principal": {"Service": "cloudfront.amazonaws.com"},
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"
        }
      }
    }
  ]
}
EOF
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file:///tmp/bucket-policy.json

# ============================================================================
# 10. Summary
# ============================================================================
echo ""
echo "=========================================="
echo "AWS Setup Complete!"
echo "=========================================="
echo ""
echo "S3 Bucket:                $BUCKET"
echo "CloudFront Distribution:  $DIST_ID"
echo "CloudFront Domain:        $CF_DOMAIN"
echo ""
echo "Update runtime-config.json:"
echo "  \"manifestBaseUrl\": \"https://${CF_DOMAIN}/sequences/\""
echo ""
echo "Next steps:"
echo "1) Run pkl2web_min.py to convert PKL files to sequences/"
echo "2) Upload sequences/ to S3:"
echo "   aws s3 sync ./sequences s3://${BUCKET}/sequences \\"
echo "     --cache-control 'public, max-age=31536000, immutable'"
echo "3) Invalidate manifests:"
echo "   aws cloudfront create-invalidation --distribution-id ${DIST_ID} \\"
echo "     --paths '/sequences/*/manifest*.json' '/sequences/*/manifest.json'"
echo ""
echo "Note: Distribution propagation takes ~10-20 minutes."
echo ""

# Save outputs to file for reference
cat > /tmp/aws-outputs.txt <<EOF
ACCOUNT_ID=$ACCOUNT_ID
BUCKET=$BUCKET
DIST_ID=$DIST_ID
CF_DOMAIN=$CF_DOMAIN
OAC_ID=$OAC_ID
RHP_ID=$RHP_ID
ORP_ID=$ORP_ID
DEFAULT_CACHE_POLICY_ID=$DEFAULT_CACHE_POLICY_ID
VERCEL_ORIGIN=$VERCEL_ORIGIN
EOF
echo "Outputs saved to /tmp/aws-outputs.txt"
