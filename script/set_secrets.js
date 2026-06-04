const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const projectId = 'clausync-demo';
const environment = 'dev';

const secrets = {
  'database_url': '***SECRET_REMOVED***',
  'redis_url': '***SECRET_REMOVED***'
};

async function addSecretVersions() {
  const client = new SecretManagerServiceClient();

  for (const [key, value] of Object.entries(secrets)) {
    const secretId = `clausync-${key}-${environment}`;
    const parent = `projects/${projectId}/secrets/${secretId}`;

    try {
      const [version] = await client.addSecretVersion({
        parent: parent,
        payload: {
          data: Buffer.from(value, 'utf8'),
        },
      });
      console.log(`Added secret version ${version.name}`);
    } catch (error) {
      console.error(`Failed to add secret version for ${key}:`, error);
    }
  }
}

addSecretVersions();
