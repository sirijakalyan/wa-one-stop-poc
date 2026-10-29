// Loads settings from AWS Secrets Manager into process.env before the server starts.
// Set SECRETS_ID to the secret's name or ARN. The secret is one JSON object, for example
//   { "DATABASE_URL": "...", "SENDGRID_API_KEY": "...", "ADMIN_KEY": "..." }
// Values already set as real environment variables win, so a one-off override still works. Nothing is written to disk or logged.
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export async function loadSecrets(env = process.env, client) {
  const id = env.SECRETS_ID;
  if (!id) return { loaded: 0 };
  const cl = client || new SecretsManagerClient({ region: env.AWS_REGION || env.AWS_DEFAULT_REGION || (id.startsWith('arn:') ? id.split(':')[3] : undefined) });
  let doc;
  try {
    const r = await cl.send(new GetSecretValueCommand({ SecretId: id }));
    doc = JSON.parse(r.SecretString || '{}');
  } catch (err) {
    throw new Error(`Could not read the secret "${id.split(':').pop()}" from AWS Secrets Manager (${err.name || 'error'}). Check SECRETS_ID, the region and that the server's role may read it.`);
  }
  let loaded = 0;
  for (const [k, v] of Object.entries(doc)) {
    if (typeof v !== 'string' || !v || env[k]) continue;
    env[k] = v;
    loaded += 1;
  }
  return { loaded };
}
