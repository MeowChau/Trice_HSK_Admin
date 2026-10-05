export const APP_URL = `http://localhost:${process.env.APP_PORT}`;
export const TESTER_EMAIL = 'john.doe@example.com';
export const TESTER_PASSWORD = 'secret';
export const ADMIN_EMAIL = historyPrivateCredential("SEED_ADMIN_EMAIL");
export const ADMIN_PASSWORD = historyPrivateCredential("SEED_ADMIN_PASSWORD");
export const MAIL_HOST = process.env.MAIL_HOST;
export const MAIL_PORT = process.env.MAIL_CLIENT_PORT;
function historyPrivateCredential(name: string): string {
    const value = process.env[name];
    if (!value)
        throw new Error("Required private configuration: " + name);
    return value;
}
