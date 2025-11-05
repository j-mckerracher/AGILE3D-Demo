---
tags: [infra, aws, cost-minimal]
plan_title: "Infrastructure Plan — Minimal-Cost Option B (Vercel + CloudFront + S3)"
created: "2025-11-01"
context: "SPA hosted on Vercel; data sequences via S3 + CloudFront; ≤10 concurrent users; very low budget"
---

# Infrastructure Plan — Minimal-Cost Option B (Vercel + CloudFront + S3)

Attached requirements
- Single private S3 bucket behind one CloudFront distribution (with OAC). No Route 53/ACM, no WAF, no API Gateway/Lambda, no custom domain. Use CloudFront default domain.
- Caching: frames (*.bin) immutable 1 year; manifests 300s. Range‑GET and CORS for Vercel domain + http://localhost:4200.
- Minimal IAM for upload script with S3 write and CloudFront invalidation.
- SPA runtime-config manifestBaseUrl points to CloudFront domain.

## Prerequisites
- AWS CLI v2, jq installed and authenticated to the target AWS account.
- Chosen Vercel deployment URL (e.g., https://agile3d-demo.vercel.app).
- You have the sequences directory locally to upload when ready.

## Step-by-step checklist

1) Define project variables
- Run:
```
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1
PROJECT=agile3d-demo
BUCKET=${PROJECT}-sequences-${ACCOUNT_ID}-${AWS_REGION}
VERCEL_ORIGIN=https://agile3d-demo.vercel.app   # replace with your Vercel URL
LOCAL_DEV_ORIGIN=http://localhost:4200
PRICE_CLASS=PriceClass_100
TS=$(date +%Y%m%d-%H%M%S)
```
- Optional: persist to .agile3d.env for reuse.

2) Create S3 bucket (private, encrypted, block public)
- Create bucket:
```
if [ "$AWS_REGION" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "$BUCKET"
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION" \
    --create-bucket-configuration LocationConstraint="$AWS_REGION"
fi
```
- Block public access and enable encryption:
```
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration '{"BlockPublicAcls":true,"IgnorePublicAcls":true,"BlockPublicPolicy":true,"RestrictPublicBuckets":true}'
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

3) Configure S3 CORS (Vercel + localhost; Range support)
- Create s3-cors.json:
```
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "https://agile3d-demo.vercel.app",
        "http://localhost:4200"
      ],
      "AllowedMethods": ["GET","HEAD","OPTIONS"],
      "AllowedHeaders": ["Range","Content-Type","Origin","Access-Control-Request-Headers","Access-Control-Request-Method"],
      "ExposeHeaders": ["Accept-Ranges","Content-Length","Content-Range"],
      "MaxAgeSeconds": 600
    }
  ]
}
```
- Apply:
```
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration file://s3-cors.json
```

4) Create CloudFront Origin Access Control (OAC)
- oac.json:
```
{
  "OriginAccessControlConfig": {
    "Name": "AGILE3D-OAC",
    "Description": "OAC for AGILE3D S3 origin",
    "SigningProtocol": "sigv4",
    "SigningBehavior": "always",
    "OriginAccessControlOriginType": "s3"
  }
}
```
- Create and capture OAC_ID:
```
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config file://oac.json \
  --query 'OriginAccessControl.Id' --output text)
```

5) Create CloudFront Response Headers Policy (CORS + Range headers)
- cf-response-headers-policy.json:
```
{
  "ResponseHeadersPolicyConfig": {
    "Name": "AGILE3D-CORS-Expose-Range",
    "Comment": "CORS for Vercel + localhost; expose Range-related headers",
    "CorsConfig": {
      "AccessControlAllowOrigins": {"Quantity": 2, "Items": ["https://agile3d-demo.vercel.app","http://localhost:4200"]},
      "AccessControlAllowHeaders": {"Quantity": 2, "Items": ["range","content-type"]},
      "AccessControlAllowMethods": {"Quantity": 3, "Items": ["GET","HEAD","OPTIONS"]},
      "AccessControlExposeHeaders": {"Quantity": 3, "Items": ["Accept-Ranges","Content-Length","Content-Range"]},
      "AccessControlMaxAgeSec": 600,
      "OriginOverride": true
    }
  }
}
```
- Create and capture RHP_ID:
```
RHP_ID=$(aws cloudfront create-response-headers-policy \
  --response-headers-policy-config file://cf-response-headers-policy.json \
  --query 'ResponseHeadersPolicy.Id' --output text)
```

6) Create CloudFront Origin Request Policy (forward Origin, A-C-R-*, Range)
- cf-origin-request-policy.json:
```
{
  "OriginRequestPolicyConfig": {
    "Name": "AGILE3D-CORS-Range",
    "Comment": "Forward Origin, Access-Control-Request-* and Range to S3",
    "HeadersConfig": {
      "HeaderBehavior": "whitelist",
      "Headers": {"Quantity": 4, "Items": ["Origin","Access-Control-Request-Method","Access-Control-Request-Headers","Range"]}
    },
    "CookiesConfig": {"CookieBehavior": "none"},
    "QueryStringsConfig": {"QueryStringBehavior": "none"}
  }
}
```
- Create and capture ORP_ID:
```
ORP_ID=$(aws cloudfront create-origin-request-policy \
  --origin-request-policy-config file://cf-origin-request-policy.json \
  --query 'OriginRequestPolicy.Id' --output text)
```

7) Create CloudFront Cache Policy (default uses origin Cache-Control; fallback 300s)
- cf-cache-policy-default.json:
```
{
  "CachePolicyConfig": {
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
}
```
- Create and capture DEFAULT_CACHE_POLICY_ID:
```
DEFAULT_CACHE_POLICY_ID=$(aws cloudfront create-cache-policy \
  --cache-policy-config file://cf-cache-policy-default.json \
  --query 'CachePolicy.Id' --output text)
```

8) Create CloudFront distribution (single origin/behavior; OAC; PriceClass_100)
- cloudfront-distribution.json (uses envsubst):
```
{
  "CallerReference": "agile3d-${TS}",
  "Comment": "AGILE3D-Demo minimal-cost (S3+CF OAC)",
  "Enabled": true,
  "PriceClass": "${PRICE_CLASS}",
  "Origins": {"Quantity": 1, "Items": [
    {"Id": "s3origin", "DomainName": "${BUCKET}.s3.amazonaws.com",
     "S3OriginConfig": {"OriginAccessIdentity": ""},
     "OriginAccessControlId": "${OAC_ID}"}
  ]},
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {"Quantity": 3, "Items": ["GET","HEAD","OPTIONS"],
      "CachedMethods": {"Quantity": 3, "Items": ["GET","HEAD","OPTIONS"]}},
    "Compress": true,
    "CachePolicyId": "${DEFAULT_CACHE_POLICY_ID}",
    "OriginRequestPolicyId": "${ORP_ID}",
    "ResponseHeadersPolicyId": "${RHP_ID}"
  },
  "Restrictions": {"GeoRestriction": {"RestrictionType": "none", "Quantity": 0}},
  "ViewerCertificate": {"CloudFrontDefaultCertificate": true, "MinimumProtocolVersion": "TLSv1.2_2021"},
  "HttpVersion": "http2",
  "IsIPV6Enabled": true
}
```
- Create and capture DIST_ID and CF_DOMAIN:
```
cat cloudfront-distribution.json | envsubst > cf.dist.evaluated.json
CF_OUT=$(aws cloudfront create-distribution --distribution-config file://cf.dist.evaluated.json)
DIST_ID=$(echo "$CF_OUT" | jq -r '.Distribution.Id')
CF_DOMAIN=$(echo "$CF_OUT" | jq -r '.Distribution.DomainName')
```

9) Attach bucket policy to allow only this CloudFront distribution
- bucket-policy.json:
```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontReadViaOAC",
      "Effect": "Allow",
      "Principal": {"Service": "cloudfront.amazonaws.com"},
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET}/*",
      "Condition": {"StringEquals": {"AWS:SourceArn": "arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"}}
    }
  ]
}
```
- Apply:
```
cat bucket-policy.json | envsubst > bucket-policy.evaluated.json
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file://bucket-policy.evaluated.json
```

10) Create least-privilege IAM for upload script (S3 write + CF invalidation)
- iam-policy.json:
```
{
  "Version": "2012-10-17",
  "Statement": [
    {"Sid": "ListBucket", "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::${BUCKET}"},
    {"Sid": "WriteDeleteObjects", "Effect": "Allow", "Action": ["s3:PutObject","s3:DeleteObject","s3:AbortMultipartUpload","s3:ListBucketMultipartUploads","s3:ListMultipartUploadParts"], "Resource": "arn:aws:s3:::${BUCKET}/*"},
    {"Sid": "InvalidateCF", "Effect": "Allow", "Action": ["cloudfront:CreateInvalidation"], "Resource": "arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"}
  ]
}
```
- Create user + attach policy (or replace with CI OIDC later):
```
cat iam-policy.json | envsubst > iam-policy.evaluated.json
POLICY_ARN=$(aws iam create-policy --policy-name AGILE3D-Uploader-Policy \
  --policy-document file://iam-policy.evaluated.json --query 'Policy.Arn' --output text)
aws iam create-user --user-name agile3d-uploader
aws iam attach-user-policy --user-name agile3d-uploader --policy-arn "$POLICY_ARN"
# Create access keys and store securely (never commit)
aws iam create-access-key --user-name agile3d-uploader > uploader.keys.json
```

11) Upload sequences with correct metadata and invalidate manifests
- Example upload script (upload_sequences.sh):
```
set -euo pipefail
: "${BUCKET:?missing}"; : "${DIST_ID:?missing}"
SEQS_DIR=./sequences

# Frames + det/gt JSON: immutable 1y (relies on origin Cache-Control)
aws s3 sync "$SEQS_DIR" "s3://${BUCKET}/sequences" \
  --exclude "*" --include "*/frames/*.bin" --include "*/frames/*.det.*.json" --include "*/frames/*.gt.json" \
  --content-type application/octet-stream --cache-control "public, max-age=31536000, immutable" \
  --metadata-directive REPLACE --size-only

# Manifests: 300s
aws s3 sync "$SEQS_DIR" "s3://${BUCKET}/sequences" \
  --exclude "*" --include "*/manifest.json" --include "*manifest*.json" \
  --content-type application/json --cache-control "public, max-age=300" \
  --metadata-directive REPLACE --size-only

# Invalidate manifests to publish updates
aws cloudfront create-invalidation --distribution-id "$DIST_ID" \
  --paths "/sequences/*/manifest*.json" "/sequences/*/manifest.json"
```

12) Update SPA runtime-config and deploy to Vercel
- Set manifestBaseUrl to CloudFront default domain (no custom DNS needed):
```
{
  "manifestBaseUrl": "https://${CF_DOMAIN}/sequences/"
}
```
- Deploy the SPA on Vercel; ensure it requests manifests at the above base URL.

13) Verify CORS, Range‑GET, and caching
- CORS on GET:
```
curl -I "https://${CF_DOMAIN}/sequences/SEQ001/manifest.json" -H "Origin: ${VERCEL_ORIGIN}"
```
- Preflight (OPTIONS) for Range header:
```
curl -i -X OPTIONS "https://${CF_DOMAIN}/sequences/SEQ001/frames/frame_000001.bin" \
  -H "Origin: ${VERCEL_ORIGIN}" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: range"
```
- Range GET:
```
curl -I "https://${CF_DOMAIN}/sequences/SEQ001/frames/frame_000001.bin" \
  -H "Origin: ${VERCEL_ORIGIN}" -H "Range: bytes=0-1023"
```
- Caching spot-check (x-cache):
```
curl -I "https://${CF_DOMAIN}/sequences/SEQ001/frames/frame_000001.bin"
curl -I "https://${CF_DOMAIN}/sequences/SEQ001/frames/frame_000001.bin"
```

14) Cost guardrails and housekeeping
- PriceClass_100; no custom domain, no WAF, no logs, no Origin Shield.
- Keep sequences small; immutable content paths; invalidate only manifests.
- Record outputs: BUCKET, DIST_ID, CF_DOMAIN, applied policies. Persist commands/files in repo docs (not secrets).

## Notes / Future toggles
- Signed URLs: off by default; add later only if abuse (surge in bytes/req).
- /metrics backend: skip to save cost; reintroduce via API Gateway + Lambda if needed later.
- Optional staging: use prefixes like /staging and /prod under the same bucket/distribution.
