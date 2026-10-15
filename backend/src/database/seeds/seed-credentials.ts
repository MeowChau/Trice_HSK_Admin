export function getSeedCredentials(kind: 'admin' | 'user') {
  const prefix = kind === 'admin' ? 'SEED_ADMIN' : 'SEED_USER';
  const production = process.env.NODE_ENV === 'production';
  const email = process.env[`${prefix}_EMAIL`]?.trim();
  const password = process.env[`${prefix}_PASSWORD`];
  if (kind === 'user' && !email && !password) return null;
  if (!email || !password || (production && password.length < 12)) {
    throw new Error(
      `${prefix}_EMAIL and ${prefix}_PASSWORD are required; production seed passwords must have at least 12 characters`,
    );
  }
  return {
    email: email.toLowerCase(),
    username: email.toLowerCase(),
    password,
  };
}
