const fs = require('node:fs');
const { AppDataSource: db } = require('/app/dist/database/data-source.js');

const tables = ['user', 'vocabulary', 'question', 'practice_set', 'exam', 'file'];

async function main() {
  if (process.env.DATABASE_NAME !== process.env.EXPECTED_DATABASE ||
      process.env.DATABASE_HOST !== 'postgres' || process.env.DATABASE_URL) {
    throw new Error('The candidate does not use the existing VPS database.');
  }
  // Connecting must never run migrations, seed, schema synchronization or writes.
  db.setOptions({ synchronize: false, dropSchema: false, migrationsRun: false, logging: false });
  await db.initialize();
  try {
    const counts = await db.transaction(async manager => {
      await manager.query('SET TRANSACTION READ ONLY');
      const columns = await manager.query(
        "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'",
      );
      const available = new Set(columns.map(row => `${row.table_name}.${row.column_name}`));
      const missing = db.entityMetadatas.flatMap(entity => entity.columns
        .filter(column => !available.has(`${entity.tableName}.${column.databaseName}`))
        .map(column => `${entity.tableName}.${column.databaseName}`));
      if (missing.length) {
        throw new Error(`Existing database lacks columns required by this version: ${missing.join(', ')}`);
      }
      const result = {};
      for (const table of tables) {
        const [row] = await manager.query(`SELECT COUNT(*)::text AS count FROM "${table}"`);
        result[table] = row.count;
      }
      return result;
    });
    if (process.argv[2] === 'verify') {
      const previous = JSON.parse(fs.readFileSync('/backup/counts-before.json', 'utf8'));
      for (const table of tables) {
        if (counts[table] !== previous[table]) {
          throw new Error(`Unexpected row count change in ${table}; keep the backup for investigation.`);
        }
      }
      console.log('SOURCE_DATABASE_VERIFIED: existing database and row counts retained.');
    } else if (process.argv[2] === 'snapshot') {
      fs.writeFileSync('/backup/counts-before.json', `${JSON.stringify(counts)}\n`, { mode: 0o600 });
      console.log('SOURCE_DATABASE_SNAPSHOT_OK');
    } else if (process.argv[2] === 'preflight') {
      console.log('SOURCE_SCHEMA_OK: this update needs no schema changes.');
    } else {
      throw new Error('Unknown database verification operation.');
    }
  } finally {
    await db.destroy();
  }
}

main().catch(error => {
  // Do not expose database configuration, credentials or query parameter values.
  const message = error.message.startsWith('Existing database lacks columns') ||
    error.message.startsWith('Unexpected row count change') ? error.message :
    'Database verification failed; the update cannot continue.';
  console.error(`SOURCE_DATABASE_CHECK_FAILED: ${message}`);
  process.exitCode = 1;
});
