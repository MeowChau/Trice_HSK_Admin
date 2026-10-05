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

  const dummyQ = await AppDataSource.query(`
    SELECT id, payload->>'text' as text 
    FROM question 
    WHERE "hskLevel" = 1 
      AND (
        payload->>'text' LIKE '%Question%' 
        OR payload->>'text' LIKE '%Sample%' 
        OR payload->>'text' LIKE 'Listening Question%'
        OR payload->>'text' LIKE 'Reading Question%'
      );
  `);
  console.log('Dummy questions found in HSK 1:', dummyQ.length);
  console.table(dummyQ.slice(0, 20));

  await AppDataSource.destroy();
}

main().catch(console.error);
