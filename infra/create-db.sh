#!/usr/bin/env bash
# Run in AWS CloudShell (us-east-1) AFTER setup.sh:   bash create-db.sh
# Creates a small private PostgreSQL database (RDS) that only your Beanstalk server can reach,
# makes a random password, and stores the connection string in the secret wa-onestop/app.
# You type nothing secret. The password is never printed or saved to a file.
set -euo pipefail
ENV_NAME=${ENV_NAME:-wa-onestop-env}
SECRET=${SECRET:-wa-onestop/app}
DBID=${DBID:-wa-onestop-db}

echo "1/5 Finding your Beanstalk server..."
INST=$(aws elasticbeanstalk describe-environment-resources --environment-name "$ENV_NAME" --query 'EnvironmentResources.Instances[0].Id' --output text)
[ -n "$INST" ] && [ "$INST" != None ] || { echo "No running instance found for $ENV_NAME."; exit 1; }
read -r VPC APPSG <<<"$(aws ec2 describe-instances --instance-ids "$INST" --query 'Reservations[0].Instances[0].[VpcId,SecurityGroups[0].GroupId]' --output text)"
echo "  VPC $VPC, server security group $APPSG"

echo "2/5 Creating a firewall rule: only the Beanstalk server may connect on port 5432..."
DBSG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=$DBID-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
if [ "$DBSG" = None ]; then
  DBSG=$(aws ec2 create-security-group --group-name "$DBID-sg" --description "WA One-Stop database" --vpc-id "$VPC" --query GroupId --output text)
  aws ec2 authorize-security-group-ingress --group-id "$DBSG" --protocol tcp --port 5432 --source-group "$APPSG" >/dev/null
fi

echo "3/5 Creating the subnet group..."
SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC --query 'Subnets[].SubnetId' --output text)
aws rds describe-db-subnet-groups --db-subnet-group-name "$DBID-subnets" >/dev/null 2>&1 || \
  aws rds create-db-subnet-group --db-subnet-group-name "$DBID-subnets" --db-subnet-group-description "WA One-Stop" --subnet-ids $SUBNETS >/dev/null

echo "4/5 Creating the database (about 5 to 10 minutes)..."
if ! aws rds describe-db-instances --db-instance-identifier "$DBID" >/dev/null 2>&1; then
  PW=$(openssl rand -hex 16)
  aws rds create-db-instance --db-instance-identifier "$DBID" --engine postgres --db-instance-class db.t4g.micro \
    --allocated-storage 20 --storage-encrypted --no-publicly-accessible --backup-retention-period 7 \
    --master-username waadmin --master-user-password "$PW" --db-name onestop \
    --vpc-security-group-ids "$DBSG" --db-subnet-group-name "$DBID-subnets" >/dev/null
  aws rds wait db-instance-available --db-instance-identifier "$DBID"
  HOST=$(aws rds describe-db-instances --db-instance-identifier "$DBID" --query 'DBInstances[0].Endpoint.Address' --output text)

  echo "5/5 Saving the connection string in Secrets Manager..."
  CUR=$(aws secretsmanager get-secret-value --secret-id "$SECRET" --query SecretString --output text)
  NEW=$(CUR="$CUR" URL="postgres://waadmin:$PW@$HOST:5432/onestop?sslmode=no-verify" python3 -c 'import json,os; d=json.loads(os.environ["CUR"]); d["DATABASE_URL"]=os.environ["URL"]; print(json.dumps(d))')
  aws secretsmanager put-secret-value --secret-id "$SECRET" --secret-string "$NEW" >/dev/null
  unset PW CUR NEW
else
  echo "  Database $DBID already exists. Nothing created. (To store its URL, add DATABASE_URL to the secret by hand.)"
fi
echo
echo "Done. Now redeploy the app in Elastic Beanstalk. On start it creates its tables and logs 'Storage: PostgreSQL'."
