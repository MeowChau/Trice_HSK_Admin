export const APP_URL = `http://localhost:${process.env.APP_PORT}`;
function requiredCredential(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is required for authentication E2E tests`);
  return value;
}
export const TESTER_EMAIL = requiredCredential('SEED_USER_EMAIL');
export const TESTER_PASSWORD = requiredCredential('SEED_USER_PASSWORD');
export const ADMIN_EMAIL = requiredCredential('SEED_ADMIN_EMAIL');
export const ADMIN_PASSWORD = requiredCredential('SEED_ADMIN_PASSWORD');
export const MAIL_HOST = process.env.MAIL_HOST;
export const MAIL_PORT = process.env.MAIL_CLIENT_PORT;
