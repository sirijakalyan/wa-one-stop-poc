# AWS setup: Cognito (sign in) and Secrets Manager (settings)

What this gives you
- People, emails and passwords live in an AWS Cognito user pool. People choose their own password (sign up, or the emailed reset
  code), so every password is permanent. The app never creates anyone with a temporary password and never stores a password.
- Database address, SendGrid key and admin key live in one Secrets Manager secret. The server reads it at start. No key is in
  git, in the build or in the Elastic Beanstalk settings.
- The app still keeps plans, ticked steps and the activity log in your database, keyed by the Cognito user id.

Steps (about 15 minutes, you do them in the AWS console)
1. CloudFormation, then Create stack, then With new resources. Upload `infra/cognito-and-secrets.yaml`. Name it `wa-onestop-auth`.
   Region: the same as Elastic Beanstalk (us-east-1). Accept the defaults and create. Wait for CREATE_COMPLETE.
2. Open the stack's Outputs tab. You need `UserPoolId`, `UserPoolClientId`, `SecretName` and `ServerPolicyArn`.
3. IAM, then Roles, then `aws-elasticbeanstalk-ec2-role`, then Add permissions, then Attach policies. Attach the policy named in
   `ServerPolicyArn`. This lets the server read the secret and manage users. It holds no keys.
4. Secrets Manager, then the secret `wa-onestop/app`, then Retrieve secret value, then Edit. Add two lines by hand:
   `DATABASE_URL` (your Postgres address) and `SENDGRID_API_KEY` (a new key, never one pasted in chat or email).
   Keep the lines already there. `ADMIN_KEY` was generated for you.
5. Elastic Beanstalk, then your environment, then Configuration, then Updates, monitoring, and logging, then Environment properties.
   Remove any old secret rows (`SENDGRID_API_KEY`, `DATABASE_URL`, `ADMIN_KEY`). Add only these, then Apply:
   - `SECRETS_ID` = `wa-onestop/app`
   - `AWS_REGION` = `us-east-1`
   - `PUBLIC_URL` = `https://d2qf951ps83bi7.cloudfront.net`
   - `ADMIN_EMAILS` = the email of the first admin
   - `TRUST_PROXY` = `3`
   Pool id, client id and the sender address come from the secret.
6. Sign up with the admin email, enter the 6-digit code from the email, sign in. That email is put in the `admins` group
   automatically. After that, admins can make other people admins in Admin, then Users.

Checks
- The server log at start says `Secrets: loaded N setting(s) from AWS Secrets Manager` and `Sign in: AWS Cognito`.
- Cognito, then your user pool, then Users shows each person. Nobody should be in the state FORCE_CHANGE_PASSWORD.

Good to know
- The default Cognito email sender allows about 50 emails a day. For real use, open the user pool, then Messaging, and switch
  to Amazon SES (verify `hr@knackhook.com` in SES). SendGrid still sends the renewal reminders.
- Existing demo accounts made before this change stay in the app store and are not copied into Cognito.
- Locally, leave `COGNITO_USER_POOL_ID` and `SECRETS_ID` unset: the app then uses its own demo accounts and your `.env`.

Shortcut for steps 1 to 4 (CloudShell)
- Open AWS CloudShell (the `>_` icon), choose Actions, then Upload file, and upload `infra/cognito-and-secrets.yaml` and `infra/setup.sh`.
- Run `bash setup.sh`. It deploys the stack, attaches the server policy and asks for `DATABASE_URL` and the new SendGrid key in
  hidden prompts. Then do step 5 (Beanstalk properties) by hand. This script has not been run against a real account by its author.
