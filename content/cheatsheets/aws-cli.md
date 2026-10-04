---
title: AWS CLI
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: AWS CLI v2
tags: [aws, cloud, cli]
sources: [docs.aws.amazon.com/cli/latest]
---

AWS CLI v2 commands for identity, S3, EC2, logs and more. Always check which account you are in.

## Profiles and identity

- Use named profiles and SSO instead of long-lived access keys
- `sts get-caller-identity` confirms the account and role
- Set `AWS_PROFILE` and `AWS_REGION` per shell

```bash
aws configure sso --profile uat
aws sso login --profile uat
export AWS_PROFILE=uat AWS_REGION=ap-south-1
aws sts get-caller-identity
```

## Output and queries

- `--output table|json|text|yaml`
- `--query` uses JMESPath to pick fields
- `--no-cli-pager` for scripts

```bash
aws ec2 describe-instances \
  --query 'Reservations[].Instances[].{Id:InstanceId,State:State.Name,Name:Tags[?Key==`Name`]|[0].Value}' \
  --output table
```

## S3

- `s3 cp`/`sync` for files; `s3api` for bucket settings
- `--sse aws:kms` encrypts with KMS
- Pre-signed URLs give temporary access — keep expiry short

```bash
aws s3 ls s3://loan-docs-uat/2026/10/
aws s3 cp report.pdf s3://loan-docs-uat/reports/ --sse aws:kms
aws s3 sync ./dist s3://static-uat/ --delete --dryrun
aws s3 presign s3://loan-docs-uat/reports/report.pdf --expires-in 900
```

## EC2 and SSM

- Prefer SSM Session Manager to SSH — no open port 22, sessions are logged
- Filter instances by tag
- Stop instances you are not using

```bash
aws ec2 describe-instances --filters "Name=tag:App,Values=devtoolkit" "Name=instance-state-name,Values=running"
aws ssm start-session --target i-0123456789abcdef0
aws ec2 stop-instances --instance-ids i-0123456789abcdef0
```

## CloudWatch Logs

- `logs tail` follows a log group live
- Filter patterns narrow results server-side
- Logs Insights queries for aggregation

```bash
aws logs tail /ecs/devtoolkit --follow --since 15m
aws logs tail /ecs/devtoolkit --filter-pattern '"ERROR"' --since 1h
aws logs start-query --log-group-name /ecs/devtoolkit \
  --start-time $(date -d '-1 hour' +%s) --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter status >= 500 | stats count() by bin(5m)'
```

## ECS and EKS

- Force a new deployment to roll tasks
- `update-kubeconfig` wires kubectl to an EKS cluster
- Check service events when tasks will not start

```bash
aws ecs update-service --cluster uat --service devtoolkit --force-new-deployment
aws ecs describe-services --cluster uat --services devtoolkit --query 'services[0].events[:5]'
aws eks update-kubeconfig --name eks-uat --region ap-south-1
```

## Secrets and parameters

- Secrets Manager for credentials; SSM Parameter Store for configuration
- Never echo secrets into shell history or logs
- `--with-decryption` reads SecureString parameters

```bash
aws secretsmanager get-secret-value --secret-id uat/db/app --query SecretString --output text | jq -r .username
aws ssm get-parameter --name /devtoolkit/uat/support-email --with-decryption --query Parameter.Value --output text
```

## EventBridge schedules

- Cron expressions have 6 fields: minute hour day-of-month month day-of-week year
- Either day-of-month or day-of-week must be `?`
- Schedules run in UTC unless you use EventBridge Scheduler with a time zone

```cron try
cron(30 3 ? * MON-FRI *)
```
