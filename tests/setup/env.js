/**
 * Must run before any `src/` import so env.ts sees test configuration.
 */
const fs = require('fs');
const path = require('path');

const uriFile = path.join(__dirname, '../../.jest-mongo-uri');
if (!fs.existsSync(uriFile)) {
  throw new Error('Missing .jest-mongo-uri — globalSetup did not run');
}

const mongoUri = fs.readFileSync(uriFile, 'utf8').trim();
if (!mongoUri.includes('workindia_test') && !mongoUri.includes('127.0.0.1') && !mongoUri.includes('localhost')) {
  // Memory server URIs often look like mongodb://127.0.0.1:xxxxx/
  // Accept memory server URIs; block accidental Atlas/production hosts.
}

if (/mongodb(\+srv)?:\/\/[^/]+\/(?!workindia_test)/.test(mongoUri) && mongoUri.includes('mongodb.net')) {
  throw new Error('Refusing to run tests against a remote MongoDB host');
}

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = mongoUri;
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.API_PREFIX = '/api/v1';
process.env.PORT = '5099';
process.env.STORAGE_PROVIDER = 'local';
process.env.STORAGE_LOCAL_ROOT = path.join(__dirname, '../.tmp-uploads');
process.env.UPLOAD_MAX_BYTES = String(5 * 1024 * 1024);
process.env.TRUST_PROXY = '0';
process.env.AUTH_RATE_LIMIT_WINDOW_MS = String(15 * 60 * 1000);
process.env.AUTH_RATE_LIMIT_MAX = '10000';
process.env.ENABLE_API_DOCS = 'true';
