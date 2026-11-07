# Deploying Music Box to AWS

This puts the `aws-redeploy` branch online with a public HTTPS link:

```
Browser ──HTTPS──► Amplify (React frontend)
   │
   ├──HTTPS──► CloudFront ──HTTP──► Elastic Beanstalk (Spring Boot, 1 instance) ──► RDS MySQL
   ├──HTTPS──► S3 (music and cover files, public read)
   └──HTTPS──► Cognito (sign up / sign in)
```

- **Region:** the commands use `eu-north-1` (Stockholm). Any region works if you use it everywhere.
- **Cost:** roughly **$30/month** (RDS ≈ $15, the server ≈ $12, its public IP ≈ $4; S3, Cognito,
  CloudFront and Amplify are cents at this traffic). New-account credits cover the first months.
  Check current prices in the [AWS Pricing Calculator](https://calculator.aws/).
- **Time:** about 30 minutes of setup on your side, plus waiting for AWS (RDS and Elastic
  Beanstalk take 5–15 minutes each to create).

The files in [`infra/aws/`](../infra/aws) hold the policies and settings the commands use.
Words in CAPITALS in them (e.g. `BUCKET_NAME`) are placeholders to replace.

---

## Part 1: Your part (can't be automated)

### 1.1 Create the AWS account
1. Sign up at <https://aws.amazon.com>.
2. **Choose the Paid plan**, not the Free plan. You still get the sign-up credits, but a Free plan
   account is **closed automatically** after 6 months or when the credits run out, and deleted 90
   days later. That's what took down the first version.
3. Turn on MFA for the root user (IAM → Dashboard → Add MFA).

### 1.2 Create an admin user for the CLI
Don't use the root user's keys.
1. IAM → Users → **Create user**, name `music-box-admin`.
2. Attach policy **AdministratorAccess** directly.
3. Open the user → Security credentials → **Create access key** → "Command Line Interface (CLI)".
4. Keep the key ID and secret for the next step. Never paste them into a chat or commit them.

When the deployment is done you can delete this key, or replace AdministratorAccess with a
narrower policy.

### 1.3 Install the AWS CLI and save the key
1. Install AWS CLI v2: <https://awscli.amazonaws.com/AWSCLIV2.msi>
2. In PowerShell:
   ```powershell
   aws configure --profile music-box
   # Access key ID / secret: from 1.2, region: eu-north-1, output: json
   aws sts get-caller-identity --profile music-box   # should print your account ID
   ```

### 1.4 Optional: let Claude run the AWS commands
The official [AWS API MCP server](https://awslabs.github.io/mcp/servers/aws-api-mcp-server)
runs on your PC with the `music-box` profile, so your keys stay on your machine.

1. Install uv (it runs the server):
   ```powershell
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```
2. Claude desktop app → **Settings → Developer → Edit Config**, and add to `mcpServers`:
   ```json
   "aws-api": {
     "command": "uvx",
     "args": ["--from", "awslabs.aws-api-mcp-server@latest", "awslabs.aws-api-mcp-server.exe"],
     "env": {
       "AWS_REGION": "eu-north-1",
       "AWS_API_MCP_PROFILE_NAME": "music-box",
       "AWS_API_MCP_WORKING_DIR": "D:\\music_box_local"
     }
   }
   ```
3. Restart the Claude desktop app. Claude asks for your approval before each AWS command.

Without the MCP server, run the commands below yourself in PowerShell from the repo folder,
adding `--profile music-box` (or run `$env:AWS_PROFILE="music-box"` once).

### 1.5 Download the music
Download the tracks (and covers, if you want them) listed in
[`backend/src/main/resources/seed/tracks.json`](../backend/src/main/resources/seed/tracks.json)
from Pixabay. Keep Pixabay's file names. Put the MP3s in `D:\music_box_local\upload\music` and
the covers in `D:\music_box_local\upload\cover`. The `upload/` folder is git-ignored, and keeping
it inside the repo folder lets the MCP server read it.

### 1.6 Switch to this branch and build the backend jar
```powershell
cd D:\music_box_local
git fetch origin
git checkout aws-redeploy
cd backend
.\mvnw.cmd clean package -DskipTests
# -> target\media_controller_iot-0.0.1-SNAPSHOT.jar
```

---

## Part 2: AWS resources (Claude via MCP, or you via the CLI)

Pick names first. The bucket name must be globally unique, e.g. `music-box-kevin-2026`.

### 2.1 Budget alert
Copy `infra/aws/budget-notifications.json` to `budget-notifications.local.json` and put your email
in the copy (`*.local.json` files are git-ignored; the steps below use the same pattern), then:
```
aws budgets create-budget --account-id ACCOUNT_ID --budget file://infra/aws/budget.json --notifications-with-subscribers file://infra/aws/budget-notifications.local.json
```
It emails you at 80% of $40 and when the month is forecast to exceed $40.

### 2.2 S3 bucket for the music
```
aws s3api create-bucket --bucket BUCKET_NAME --create-bucket-configuration LocationConstraint=eu-north-1
aws s3api put-public-access-block --bucket BUCKET_NAME --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
aws s3api put-bucket-policy --bucket BUCKET_NAME --policy file://infra/aws/s3-bucket-policy.local.json
aws s3 sync upload/music s3://BUCKET_NAME/music/
aws s3 sync upload/cover s3://BUCKET_NAME/cover/
```
Only `music/*` and `cover/*` are public. First copy `s3-bucket-policy.json` to
`s3-bucket-policy.local.json` and replace `BUCKET_NAME` in the copy.

### 2.3 Cognito user pool
```
aws cognito-idp create-user-pool --pool-name music-box-users-v2 --alias-attributes email --username-configuration CaseSensitive=false --auto-verified-attributes email --schema Name=email,Required=true,Mutable=true --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=false,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" --account-recovery-setting "RecoveryMechanisms=[{Priority=1,Name=verified_email}]" --user-pool-tier LITE
aws cognito-idp create-user-pool-client --user-pool-id USER_POOL_ID --client-name music-box-web --no-generate-secret --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH --prevent-user-existence-errors ENABLED --enable-token-revocation
```
Note the pool ID (`eu-north-1_...`) and the client ID. Sign-up confirmation codes are sent by
Cognito's built-in email (50 per day, plenty for a portfolio site).

- `--alias-attributes email`: users sign in with their username **or** their verified email.
- `--username-configuration CaseSensitive=false`: `Kevin` and `kevin` are the same account.
- Both can only be set when the pool is created. Changing them later means a new pool, and
  every user signing up again.
- The Lite tier is free up to 10,000 monthly active users.

### 2.4 RDS MySQL database
Choose a strong password without `/`, `@`, `"` or spaces.
```
aws rds create-db-instance --db-instance-identifier music-box-db --engine mysql --db-instance-class db.t4g.micro --allocated-storage 20 --storage-type gp3 --master-username admin --master-user-password DB_PASSWORD --db-name music_box --no-publicly-accessible --no-multi-az --backup-retention-period 1
aws rds wait db-instance-available --db-instance-identifier music-box-db
aws rds describe-db-instances --db-instance-identifier music-box-db --query "DBInstances[0].[Endpoint.Address,VpcSecurityGroups[0].VpcSecurityGroupId]"
```
Note the endpoint and the security group ID.

### 2.5 IAM role for the backend server
Copy `eb-s3-access-policy.json` to `eb-s3-access-policy.local.json` and replace `BUCKET_NAME`
in the copy, then:
```
aws iam create-role --role-name music-box-eb-ec2 --assume-role-policy-document file://infra/aws/eb-ec2-trust-policy.json
aws iam attach-role-policy --role-name music-box-eb-ec2 --policy-arn arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier
aws iam put-role-policy --role-name music-box-eb-ec2 --policy-name music-box-s3 --policy-document file://infra/aws/eb-s3-access-policy.local.json
aws iam create-instance-profile --instance-profile-name music-box-eb-ec2
aws iam add-role-to-instance-profile --instance-profile-name music-box-eb-ec2 --role-name music-box-eb-ec2
```
The backend uses this role for S3, so no access keys are stored on the server.

A new account also has no Elastic Beanstalk **service role** (the console creates it, the CLI
doesn't), and `eb-options.json` refers to it:
```
aws iam create-role --role-name aws-elasticbeanstalk-service-role --assume-role-policy-document file://infra/aws/eb-service-trust-policy.json
aws iam attach-role-policy --role-name aws-elasticbeanstalk-service-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkEnhancedHealth
aws iam attach-role-policy --role-name aws-elasticbeanstalk-service-role --policy-arn arn:aws:iam::aws:policy/AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy
```
Skip this if `aws iam get-role --role-name aws-elasticbeanstalk-service-role` already finds it.

### 2.6 Elastic Beanstalk (backend)
Copy `infra/aws/eb-options.json` to `infra/aws/eb-options.local.json` and fill in the
placeholders there (region, bucket, Cognito IDs, RDS endpoint, DB password). The `.local.json`
copy is git-ignored, so the database password never gets committed. Then upload the jar and
create the environment:
```
aws elasticbeanstalk create-storage-location
aws s3 cp backend/target/media_controller_iot-0.0.1-SNAPSHOT.jar s3://EB_STORAGE_BUCKET/music-box/backend-v1.jar
aws elasticbeanstalk create-application --application-name music-box
aws elasticbeanstalk create-application-version --application-name music-box --version-label v1 --source-bundle S3Bucket=EB_STORAGE_BUCKET,S3Key=music-box/backend-v1.jar
aws elasticbeanstalk list-available-solution-stacks --query "SolutionStacks[?contains(@, 'Corretto 21')]"
aws elasticbeanstalk create-environment --application-name music-box --environment-name music-box-api --version-label v1 --solution-stack-name "STACK_NAME_FROM_ABOVE" --option-settings file://infra/aws/eb-options.local.json
aws elasticbeanstalk describe-environments --environment-names music-box-api --query "Environments[0].[Status,Health,CNAME]"
```
`create-storage-location` prints the `EB_STORAGE_BUCKET` name
(`elasticbeanstalk-eu-north-1-ACCOUNT_ID`). Pick the stack that is just "running Corretto 21",
not a Tomcat one: the jar runs on its own (in November 2026 that was
`64bit Amazon Linux 2023 v4.14.1 running Corretto 21`). Wait until the status is `Ready`
(about 5–10 minutes) and note the CNAME (`music-box-api.eu-north-1.elasticbeanstalk.com`).

**Let the server reach the database:** find the security group Elastic Beanstalk created
(its name contains `music-box-api`), then allow it on port 3306 of the RDS security group:
```
aws ec2 describe-security-groups --filters Name=tag:elasticbeanstalk:environment-name,Values=music-box-api --query "SecurityGroups[].GroupId"
aws ec2 authorize-security-group-ingress --group-id RDS_SECURITY_GROUP_ID --protocol tcp --port 3306 --source-group EB_SECURITY_GROUP_ID
aws elasticbeanstalk restart-app-server --environment-name music-box-api
```
Each signed-in user has their own player. To let the ESP32 remote control *your* player, add the
environment property `REMOTE_USER_ID` with your Cognito user ID (the `sub` attribute: Cognito →
User pools → Users → your user). Without it the remote drives a separate player.

Check: `http://EB_CNAME/actuator/health` shows `{"status":"UP"}`, and
`http://EB_CNAME/api/player/state` shows a song title once the seed step has run.

### 2.7 CloudFront (HTTPS for the backend)
`infra/aws/cloudfront-backend.json` already holds the IDs of the two AWS-managed policies
(`Managed-CachingDisabled` and `Managed-AllViewerExceptHostHeader`; they are the same in every
account). Copy it to `cloudfront-backend.local.json`, replace `EB_CNAME` there, then create the
distribution:
```
aws cloudfront create-distribution --distribution-config file://infra/aws/cloudfront-backend.local.json --query "Distribution.[Id,DomainName]"
```
To re-check the policy IDs:
```
aws cloudfront list-cache-policies --type managed --query "CachePolicyList.Items[?CachePolicy.CachePolicyConfig.Name=='Managed-CachingDisabled'].CachePolicy.Id"
aws cloudfront list-origin-request-policies --type managed --query "OriginRequestPolicyList.Items[?OriginRequestPolicy.OriginRequestPolicyConfig.Name=='Managed-AllViewerExceptHostHeader'].OriginRequestPolicy.Id"
```
Caching is off and all headers (including `Authorization`) are forwarded, so the API works as if
called directly. It takes a few minutes to deploy. Check `https://xxxx.cloudfront.net/actuator/health`.

---

## Part 3: Amplify (frontend), in the console

The GitHub connection needs a browser sign-in, so this part is done in the console.

1. Amplify → **Create new app** → GitHub → authorize → repository `Keffii/music_box`,
   branch `aws-redeploy`.
2. Tick **My app is a monorepo** and enter `frontend`. The build settings come from
   `amplify.yml` in the repo root.
3. Under **Advanced settings → Environment variables** add:

   | Variable | Value |
   |---|---|
   | `REACT_APP_API_BASE` | `https://xxxx.cloudfront.net` (no trailing slash) |
   | `REACT_APP_COGNITO_USER_POOL_ID` | the pool ID from 2.3 |
   | `REACT_APP_COGNITO_APP_CLIENT_ID` | the client ID from 2.3 |

4. **Save and deploy.** The site URL looks like `https://aws-redeploy.d1abc2def3.amplifyapp.com`.
5. Lock CORS down to that URL:
   ```
   aws elasticbeanstalk update-environment --environment-name music-box-api --option-settings Namespace=aws:elasticbeanstalk:application:environment,OptionName=CORS_ALLOWED_ORIGINS,Value=https://aws-redeploy.d1abc2def3.amplifyapp.com
   ```
6. Put the site URL in the link-preview tags in `frontend/public/index.html` (`og:url`,
   `og:image`, `twitter:image`). Preview images need a full URL, so change these again if
   you move to a custom domain.

Pages have their own addresses (`/library`, `/genre/lofi`, `/playlist/3`, `/search?q=...`).
Amplify serves `index.html` for these with a rewrite rule (**Hosting → Rewrites and
redirects**). The rule new apps get leaves out `.webp` and `.jpeg`, so those images come back
as the HTML page instead. Use this rule, from
`</^[^.]+$|\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|webp|woff|woff2|ttf|map|json|webmanifest)$)([^.]+$)/>`
to `/index.html`, type **200 (Rewrite)**.

---

## Part 4: Check it end to end

- [ ] Open the Amplify URL, sign up, enter the emailed code, sign in.
- [ ] Songs appear in their categories with covers; play, pause, next, volume and seek work.
- [ ] Favorites and playlists save and survive a page reload.
- [ ] Open the site in a second browser: pressing play in one updates the other (live sync).
- [ ] Open a genre, then press the browser's Back button: you're on the home page again.
      Reloading `/genre/lofi` opens that genre directly.
- [ ] Put the link in the README's **Website** section.

## Updating the backend later
```powershell
.\mvnw.cmd clean package -DskipTests
aws s3 cp target\media_controller_iot-0.0.1-SNAPSHOT.jar s3://EB_STORAGE_BUCKET/music-box/backend-v2.jar
aws elasticbeanstalk create-application-version --application-name music-box --version-label v2 --source-bundle S3Bucket=EB_STORAGE_BUCKET,S3Key=music-box/backend-v2.jar
aws elasticbeanstalk update-environment --environment-name music-box-api --version-label v2
```
The frontend redeploys automatically when you push to `aws-redeploy`.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| Backend health is red, logs say "Communications link failure" | Step 2.6 security group rule missing, or wrong RDS endpoint/password |
| Logs say "AWS_COGNITO_USER_POOL_ID is not set" | Placeholder left in `eb-options.local.json` |
| "Not in the bucket yet" for every song | Files aren't under `music/`, or the role lacks `s3:ListBucket` |
| Songs listed but won't play (403) | Bucket policy or public access block (step 2.2) |
| Browser console: CORS error | `CORS_ALLOWED_ORIGINS` doesn't match the Amplify URL exactly |
| Browser console: mixed content | `REACT_APP_API_BASE` is `http://`; it must be the CloudFront `https://` URL |
| Sign-up fails with a password error | Cognito password policy: 8+ characters with a lowercase letter and a number |

Logs: `aws elasticbeanstalk request-environment-info --environment-name music-box-api --info-type tail`,
then `retrieve-environment-info` a few seconds later, or Elastic Beanstalk console → Logs.

## Shutting it down
To stop all charges, delete in this order: Amplify app, CloudFront distribution (disable first,
then delete), Elastic Beanstalk environment and application, RDS instance (optionally with a
final snapshot), S3 buckets, Cognito user pool, IAM role and user. Then check Billing → Bills
the following day.
