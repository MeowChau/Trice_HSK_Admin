// Only for a newly restored staging database; never run against the live DB.
const path = require('node:path');
const { createRequire } = require('node:module');
const appRoot = process.argv[2] || '/app';
const appRequire = createRequire(path.join(appRoot, 'package.json'));
const { AppDataSource: db } = appRequire('./dist/database/data-source.js');
const { TableIndex } = appRequire('typeorm');

function canonicalType(value) {
  return ({ varchar: 'character varying', int4: 'integer', timestamptz: 'timestamp with time zone' })[value] || value;
}

async function run() {
  if (!/^tricehsk_import_[a-z0-9_]+$/.test(process.env.DATABASE_NAME || '') || process.env.DATABASE_URL) {
    throw new Error('Use an isolated tricehsk_import_* database with DATABASE_URL unset.');
  }
  db.setOptions({ synchronize: false, dropSchema: false, migrationsRun: false, logging: false });
  await db.initialize();
  try {
    const migration = db.migrations.find((entry) => entry.constructor.name === 'CompleteContentSchema1791535337259');
    if (!migration) throw new Error('Expected content migration missing from API image.');
    const originalUp = migration.up.bind(migration);
    migration.up = async (runner) => {
      async function addMissingColumn(tableName, column) {
        const table = await runner.getTable(tableName);
        const existing = table?.findColumnByName(column.name);
        if (!existing) return runner.addColumn(tableName, column);
        const expectedType = canonicalType(db.driver.normalizeType(column));
        if (canonicalType(existing.type) !== expectedType) {
          throw new Error(`Incompatible legacy column: ${tableName}.${column.name}`);
        }
        if (existing.isNullable !== column.isNullable) {
          // SET NOT NULL fails safely if legacy rows contain NULL; never invent data.
          const tableSql = db.driver.escape(tableName);
          const columnSql = db.driver.escape(column.name);
          await runner.query(`ALTER TABLE ${tableSql} ALTER COLUMN ${columnSql} ${column.isNullable ? 'DROP' : 'SET'} NOT NULL`);
        }
      }
      const guardedRunner = new Proxy(runner, {
        get(target, key) {
          if (key === 'addColumn') return addMissingColumn;
          if (key === 'createTable') return async (table, ...options) => {
            const existing = await runner.getTable(table.name);
            if (!existing) return runner.createTable(table, ...options);
            for (const column of table.columns) await addMissingColumn(table.name, column);
            for (const index of table.indices) {
              if (!existing.indices.some((item) => item.isUnique === index.isUnique && item.columnNames.join(',') === index.columnNames.join(','))) {
                await runner.createIndex(table.name, new TableIndex(index));
              }
            }
          };
          const value = Reflect.get(target, key);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      await originalUp(guardedRunner);
    };
    await db.runMigrations({ transaction: 'all' });
    const runner = db.createQueryRunner();
    try {
      for (const entity of db.entityMetadatas) {
        const table = await runner.getTable(entity.tableName);
        if (!table) throw new Error(`Missing table: ${entity.tableName}`);
        for (const column of entity.columns) {
          if (!table.findColumnByName(column.databaseName)) {
            throw new Error(`Missing column: ${entity.tableName}.${column.databaseName}`);
          }
        }
      }
    } finally { await runner.release(); }
    console.log('IMPORT_MIGRATIONS_OK: All API entity columns exist; legacy data retained.');
  } finally { await db.destroy(); }
}

run().catch((error) => {
  // Do not print raw TypeORM errors or query parameters.
  const message = error?.driverError ? `Database code=${error.driverError.code || 'UNKNOWN'}` : error?.message;
  console.error(`IMPORT_MIGRATIONS_FAILED: ${message || 'Unknown error'}`);
  process.exitCode = 1;
});
