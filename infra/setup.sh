#!/usr/bin/env bash
# Run this in AWS CloudShell (the >_ icon in the AWS console), in the region where Elastic Beanstalk runs (us-east-1).
#   1. Upload infra/cognito-and-secrets.yaml to CloudShell (Actions, then Upload file), then:  bash setup.sh
# It creates the Cognito user pool and the secret, lets the Beanstalk server use them, and asks you for the two secrets.
# The secrets are typed into hidden prompts. They are sent only to AWS Secrets Manager: never written to a file, never printed.
set -euo pipefail
STACK=${STACK:-wa-onestop-auth}
ROLE=${ROLE:-aws-elasticbeanstalk-ec2-role}
TEMPLATE=${TEMPLATE:-cognito-and-secrets.yaml}
[ -f "$TEMPLATE" ] || { echo "Upload $TEMPLATE to CloudShell first (Actions, Upload file)."; exit 1; }

echo "1/4 Creating the user pool, app client, admins group and secret (about 2 minutes)..."
aws cloudformation deploy --stack-name "$STACK" --template-file "$TEMPLATE" --capabilities CAPABILITY_NAMED_IAM --no-fail-on-empty-changeset
out() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
POLICY=$(out ServerPolicyArn); SECRET=$(out SecretName); POOL=$(out UserPoolId); CLIENT=$(out UserPoolClientId)

echo "2/4 Letting the Beanstalk server read the secret and manage users..."
aws iam attach-role-policy --role-name "$ROLE" --policy-arn "$POLICY"

echo "3/4 Adding your two secrets to $SECRET"
read -r -s -p "  DATABASE_URL (postgres://...): " DB; echo
read -r -s -p "  New SENDGRID_API_KEY (SG....): " SG; echo
[ -n "$DB" ] && [ -n "$SG" ] || { echo "Both values are needed. Run the script again."; exit 1; }
CUR=$(aws secretsmanager get-secret-value --secret-id "$SECRET" --query SecretString --output text)
NEW=$(CUR="$CUR" DB="$DB" SG="$SG" python3 -c 'import json,os; d=json.loads(os.environ["CUR"]); d["DATABASE_URL"]=os.environ["DB"]; d["SENDGRID_API_KEY"]=os.environ["SG"]; print(json.dumps(d))')
aws secretsmanager put-secret-value --secret-id "$SECRET" --secret-string "$NEW" >/dev/null
unset DB SG CUR NEW

echo "4/4 Done. Secret keys now stored: $(aws secretsmanager get-secret-value --secret-id "$SECRET" --query SecretString --output text | python3 -c 'import json,sys; print(", ".join(sorted(json.load(sys.stdin))))')"
echo
echo "Next, in Elastic Beanstalk (Configuration, Environment properties) add only:"
echo "  SECRETS_ID   = $SECRET"
echo "  AWS_REGION   = ${AWS_REGION:-$(aws configure get region)}"
echo "  PUBLIC_URL   = https://d2qf951ps83bi7.cloudfront.net"
echo "  ADMIN_EMAILS = (your admin email)"
echo "  TRUST_PROXY  = 3"
echo "Pool: $POOL  Client: $CLIENT (these are already inside the secret)"
