import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'secret',
  database: process.env.DATABASE_NAME || 'api',
  synchronize: false,
});

async function main() {
  await AppDataSource.initialize();
  console.log('DB connected');

  await AppDataSource.query(`ALTER TABLE "vocabulary" ADD COLUMN IF NOT EXISTS "topic" character varying;`);
  console.log('Added topic column to vocabulary successfully.');

  const cols = await AppDataSource.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='vocabulary'`);
  console.log('Vocabulary columns:', cols.map((c: any) => c.column_name));

  await AppDataSource.destroy();
}

main().catch(console.error);
