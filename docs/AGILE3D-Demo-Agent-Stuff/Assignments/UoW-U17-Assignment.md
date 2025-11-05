---
tags: [assignment, uow, agent/work-assigner]
unit_id: "U17"
project: "[[01-Projects/AGILE3D-Demo]]"
status: "ready"
created: "2025-11-01"
links:
  se_work_log: "[[SE-Log-U17]]"
---

# UoW Assignment — U17

- Project: [[01-Projects/AGILE3D-Demo]]
- SE Work Log: [[SE-Log-U17]]
- Daily note: [[2025-11-01]]

## Task Overview
Provide cross-platform shell and PowerShell scripts to upload sequences to AWS S3 with correct cache headers and CloudFront invalidation. Frames uploaded as 1-year immutable; manifests as 300s TTL.

## Success Criteria
- [ ] Frames uploaded with 1-year immutable cache; manifests uploaded with 300s TTL
- [ ] CloudFront invalidation executed for the distribution ID provided
- [ ] No credentials in repo; scripts read from environment variables
- [ ] Manual dry-run verifies headers via `aws s3api head-object`

## Constraints and Guardrails
- ≤2 files, ≤200 LOC total
- Use awscli v2; cross-platform (bash + PowerShell)
- No secrets; use env vars (STAGING_BUCKET, PROD_BUCKET, CLOUDFRONT_DISTRIBUTION_ID)
- No commits unless explicitly instructed

## Dependencies
- [[U04]] (Converter Output)

## Files to Edit or Create
- `tools/scripts/upload_sequences.sh`
- `tools/scripts/upload_sequences.ps1`

## Implementation Steps
1. Bash script: use `aws s3 sync` with `--cache-control` for frames and manifests
2. PowerShell script: equivalent logic for Windows users
3. CloudFront invalidation after upload
4. Error handling and dry-run mode

## Commands to Run
```bash
export STAGING_BUCKET=s3://my-staging-bucket
export PROD_BUCKET=s3://my-prod-bucket
export CLOUDFRONT_DISTRIBUTION_ID=E123ABC
bash tools/scripts/upload_sequences.sh --dry-run
```

## Artifacts to Return
- Unified diff for both scripts
- Manual dry-run output showing commands
- Header verification output from aws s3api
