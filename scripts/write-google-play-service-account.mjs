/**
 * Writes google-service-account.json from GOOGLE_PLAY_SERVICE_KEY_JSON.
 * Validates Play API service account shape (not Firebase google-services.json).
 */
import { writeFileSync } from 'node:fs';

const raw = process.env.GOOGLE_PLAY_SERVICE_KEY_JSON?.trim();
if (!raw) {
  console.error(
    'GOOGLE_PLAY_SERVICE_KEY_JSON is empty. Set the GitHub secret with the full JSON key from Google Cloud (service account key), not google-services.json.',
  );
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch {
  console.error(
    'GOOGLE_PLAY_SERVICE_KEY_JSON is not valid JSON. Paste the entire .json file from Cloud Console without extra quotes.',
  );
  process.exit(1);
}

const required = ['type', 'private_key', 'client_email'];
const missing = required.filter((key) => !data[key]);
if (missing.length > 0) {
  console.error(
    `Missing required fields: ${missing.join(', ')}. You likely pasted google-services.json (Firebase) instead of the Play service account key from Google Cloud → IAM → Service accounts → Keys.`,
  );
  process.exit(1);
}

if (data.type !== 'service_account') {
  console.error(`Expected type "service_account", got "${data.type}".`);
  process.exit(1);
}

writeFileSync(
  'google-service-account.json',
  `${JSON.stringify(data, null, 2)}\n`,
  'utf8',
);
console.log(`Wrote google-service-account.json for ${data.client_email}`);
