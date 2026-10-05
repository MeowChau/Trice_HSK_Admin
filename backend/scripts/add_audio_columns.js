const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'root',
    password: 'secret',
    database: 'api',
  });

  await client.connect();
  console.log('Connected to PostgreSQL database');

  try {
    await client.query('ALTER TABLE practice_set ADD COLUMN IF NOT EXISTS "audioUrl" character varying;');
    console.log('Successfully ensured audioUrl column on practice_set table');
  } catch (err) {
    console.error('Error on practice_set:', err.message);
  }

  try {
    await client.query('ALTER TABLE exam_section ADD COLUMN IF NOT EXISTS "audioUrl" character varying;');
    console.log('Successfully ensured audioUrl column on exam_section table');
  } catch (err) {
    console.error('Error on exam_section:', err.message);
  }

  await client.end();
}

main().catch(console.error);
