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
  console.log('Connected to DB');

  const sets = await AppDataSource.query(`SELECT id, title, topic, "hskLevel" FROM practice_set ORDER BY "hskLevel", id LIMIT 25;`);
  console.log('--- PRACTICE SETS ---');
  console.table(sets);

  const psq = await AppDataSource.query(`
    SELECT ps.id as ps_id, ps.title, q.id as q_id, q.payload
    FROM practice_set ps
    JOIN practice_set_question psq ON ps.id = psq."practiceSetId"
    JOIN question q ON psq."questionId" = q.id
    WHERE ps."hskLevel" = 1
    ORDER BY ps.id, q.id
    LIMIT 15;
  `);
  console.log('--- LINKED QUESTIONS FOR HSK 1 ---');
  console.log(JSON.stringify(psq, null, 2));

  await AppDataSource.destroy();
}

main().catch(console.error);
