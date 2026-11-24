// Runs in every test worker before the app is loaded. Points the app at the
// TEST database, never the one in .env, and fills the config it insists on.
export const DEFAULT_TEST_DATABASE_URL =
  'postgresql://quacker:quacker@localhost:5433/quacker_test';

export function testDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
}

process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = 'test';
process.env.BETTER_AUTH_SECRET ??=
  'integration_test_secret_at_least_32_chars_long';
process.env.SUPERADMIN_EMAIL ??= 'admin@example.com';
process.env.SUPERADMIN_PASSWORD ??= 'adminpassword';
process.env.BACKEND_URL = 'http://localhost:4050';
process.env.FRONTEND_URL = 'http://localhost:3050';
// Never send real mail from tests: fall back to the console mailer.
process.env.RESEND_API_KEY = '';
process.env.SMTP_HOST = '';
