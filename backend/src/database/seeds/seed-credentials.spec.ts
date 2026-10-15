import { randomBytes, randomUUID } from 'node:crypto';
import { getSeedCredentials } from './seed-credentials';

describe('Seed credentials must come from private configuration', () => {
  const names = [
    'NODE_ENV',
    'SEED_ADMIN_EMAIL',
    'SEED_ADMIN_PASSWORD',
    'SEED_USER_EMAIL',
    'SEED_USER_PASSWORD',
  ];
  const original = new Map(names.map((name) => [name, process.env[name]]));

  beforeEach(() => {
    for (const name of names) delete process.env[name];
  });
  afterEach(() => {
    for (const name of names) {
      const value = original.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it.each(['development', 'test', 'production'])(
    'should refuse missing admin configuration in %s',
    (environment) => {
      process.env.NODE_ENV = environment;
      expect(() => getSeedCredentials('admin')).toThrow('SEED_ADMIN_EMAIL');
    },
  );

  it('should not manufacture a password when only the email is configured', () => {
    process.env.SEED_ADMIN_EMAIL = `${randomUUID()}@test.invalid`;
    expect(() => getSeedCredentials('admin')).toThrow('SEED_ADMIN_PASSWORD');
  });

  it('should use the configured credentials without changing the password', () => {
    const email = `${randomUUID()}@test.invalid`;
    const password = randomBytes(24).toString('base64url');
    process.env.SEED_ADMIN_EMAIL = ` ${email.toUpperCase()} `;
    process.env.SEED_ADMIN_PASSWORD = password;
    expect(getSeedCredentials('admin')).toEqual({
      email,
      username: email,
      password,
    });
  });

  it.each(['development', 'production'])(
    'should skip the optional user seed when no account is configured in %s',
    (environment) => {
      process.env.NODE_ENV = environment;
      expect(getSeedCredentials('user')).toBeNull();
    },
  );

  it('should reject a partially configured optional account', () => {
    process.env.SEED_USER_PASSWORD = randomBytes(24).toString('base64url');
    expect(() => getSeedCredentials('user')).toThrow('SEED_USER_EMAIL');
  });
});
