import { DataSource } from 'typeorm';
import { VocabularyEntity } from './src/offline-games/infrastructure/persistence/relational/entities/vocabulary.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'secret',
  database: process.env.DATABASE_NAME || 'api',
  entities: [VocabularyEntity],
  synchronize: false,
});

async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(VocabularyEntity);
  
  const words = [];
  for (let i = 1; i <= 60; i++) {
    words.push({
      hanzi: `词${i}`,
      pinyin: `ci${i}`,
      meaning: `word ${i}`,
      hskLevel: 2,
    });
  }

  await repo.save(words);
  console.log('Seeded 60 words for HSK 2');
  process.exit(0);
}

seed().catch(console.error);
