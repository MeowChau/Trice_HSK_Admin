import 'reflect-metadata';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_TYPE: 'postgres',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_NAME: 'unit_test',
  DATABASE_USERNAME: 'test',
  DATABASE_PASSWORD: 'test',
});
