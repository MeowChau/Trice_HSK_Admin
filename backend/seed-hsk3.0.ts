import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
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
  
  // Clear existing to avoid duplicates during test
  await repo.clear();
  console.log('Cleared existing vocabulary.');

  const tsvDir = path.join(__dirname, 'HSK-3.0_data', 'Scripts and data', 'tsv');
  const files = fs.readdirSync(tsvDir).filter(f => f.endsWith('.tsv'));

  let totalInserted = 0;

  for (const file of files) {
    let level = 1;
    const levelMatch = file.match(/HSK (\d)/);
    if (levelMatch) {
      level = parseInt(levelMatch[1], 10);
    } else {
      continue;
    }

    const content = fs.readFileSync(path.join(tsvDir, file), 'utf8');
    const lines = content.split('\n').filter(l => l.trim() !== '');

    const vocabularies = [];
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 4) {
        // parts[0] = Traditional, parts[1] = Simplified, parts[2] = Pinyin, parts[3] = Meaning
        let hanzi = parts[1].trim();
        let pinyin = parts[2].trim();
        let meaning = parts[3].trim();
        
        // Truncate meaning if it's too long to avoid Postgres varchar(255) error
        if (meaning.length > 250) {
          meaning = meaning.substring(0, 250) + '...';
        }

        vocabularies.push(repo.create({
          hanzi,
          pinyin,
          meaning,
          hskLevel: level,
        }));
      }
    }

    // Insert in chunks to avoid query limits
    const chunkSize = 500;
    for (let i = 0; i < vocabularies.length; i += chunkSize) {
      const chunk = vocabularies.slice(i, i + chunkSize);
      await repo.save(chunk);
      totalInserted += chunk.length;
    }
    
    console.log(`Seeded ${vocabularies.length} words from ${file} for HSK ${level}`);
  }

  console.log(`Successfully seeded ${totalInserted} words!`);
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
