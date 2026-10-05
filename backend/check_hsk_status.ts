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

  // Check vocabularies
  try {
    const totalVocab = await AppDataSource.query('SELECT count(*) FROM "vocabulary"');
    console.log('Total vocabulary:', totalVocab[0].count);

    const vocabByLevel = await AppDataSource.query('SELECT "hskLevel", count(*) FROM "vocabulary" GROUP BY "hskLevel" ORDER BY "hskLevel" ASC');
    console.log('Vocabulary by HSK level:', vocabByLevel);
  } catch (e: any) {
    console.log('Vocab query error:', e.message);
  }

  // Check questions
  try {
    const totalQ = await AppDataSource.query('SELECT count(*) FROM "question"');
    console.log('Total questions:', totalQ[0].count);

    const qByLevel = await AppDataSource.query('SELECT "hskLevel", count(*) FROM "question" GROUP BY "hskLevel" ORDER BY "hskLevel" ASC');
    console.log('Questions by HSK level:', qByLevel);

    const qBySkill = await AppDataSource.query('SELECT "skill", count(*) FROM "question" GROUP BY "skill" ORDER BY "skill" ASC');
    console.log('Questions by skill:', qBySkill);
  } catch (e: any) {
    console.log('Questions query error:', e.message);
  }

  // Check practice sets
  try {
    const ps = await AppDataSource.query('SELECT "hskLevel", count(*) FROM "practice_set" GROUP BY "hskLevel" ORDER BY "hskLevel" ASC');
    console.log('Practice sets by HSK level:', ps);
  } catch (e: any) {
    console.log('Practice sets query error:', e.message);
  }

  // Check exams
  try {
    const exams = await AppDataSource.query('SELECT "hskLevel", count(*) FROM "exam" GROUP BY "hskLevel" ORDER BY "hskLevel" ASC');
    console.log('Exams by HSK level:', exams);
  } catch (e: any) {
    console.log('Exams query error:', e.message);
  }

  await AppDataSource.destroy();
}

main().catch(console.error);
