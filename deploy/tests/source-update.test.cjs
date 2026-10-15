const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../update-source.cjs'), 'utf8');
const tableNames = ['user', 'vocabulary', 'question', 'practice_set', 'exam', 'file'];

async function execute(mode, options = {}) {
  const statements = [];
  const messages = [];
  const calls = [];
  const counts = Object.fromEntries(tableNames.map(table => [table, '2']));
  let saved;
  const db = {
    entityMetadatas: tableNames.map(tableName => ({ tableName, columns: [{ databaseName: 'id' }] })),
    setOptions(value) {
      assert.equal(value.synchronize, false);
      assert.equal(value.dropSchema, false);
      assert.equal(value.migrationsRun, false);
      assert.equal(value.logging, false);
      calls.push('options');
    },
    async initialize() { calls.push('initialize'); },
    async destroy() { calls.push('destroy'); },
    async transaction(callback) {
      calls.push('transaction');
      return callback({
        async query(sql) {
          statements.push(sql);
          assert.match(sql, /^(SET TRANSACTION READ ONLY|SELECT )/);
          if (sql === 'SET TRANSACTION READ ONLY') return [];
          if (sql.includes('information_schema.columns')) {
            return tableNames.filter(table => !(options.missingSchema && table === 'question'))
              .map(table_name => ({ table_name, column_name: 'id' }));
          }
          const table = sql.match(/FROM "([a-z_]+)"/)[1];
          return [{ count: options.changedCounts && table === 'question' ? '3' : counts[table] }];
        },
      });
    },
  };
  const context = {
    require(name) {
      if (name === 'node:fs') return {
        readFileSync(file) { assert.equal(file, '/backup/counts-before.json'); return JSON.stringify(counts); },
        writeFileSync(file, value, settings) {
          assert.equal(file, '/backup/counts-before.json');
          assert.equal(settings.mode, 0o600);
          saved = JSON.parse(value);
        },
      };
      assert.equal(name, '/app/dist/database/data-source.js');
      return { AppDataSource: db };
    },
    process: {
      argv: ['node', 'operator.cjs', mode],
      env: { DATABASE_NAME: options.wrongDatabase ? 'other' : 'active_import', EXPECTED_DATABASE: 'active_import', DATABASE_HOST: 'postgres' },
      exitCode: 0,
    },
    console: { log(message) { messages.push(message); }, error(message) { messages.push(message); } },
  };
  vm.runInNewContext(source.replace('main().catch(', 'globalThis.completion = main().catch('), context);
  await context.completion;
  return { calls, statements, messages, saved, exitCode: context.process.exitCode, counts };
}

test('refuses a different database before establishing a connection', async () => {
  const result = await execute('preflight', { wrongDatabase: true });
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.calls, []);
});

test('schema preflight reads under a read-only transaction and closes the connection', async () => {
  const result = await execute('preflight');
  assert.equal(result.exitCode, 0);
  assert.equal(result.statements[0], 'SET TRANSACTION READ ONLY');
  assert.equal(result.calls.at(-1), 'destroy');
  assert.match(result.messages.join('\n'), /SOURCE_SCHEMA_OK/);
});

test('missing schema stops the update and does not create a snapshot', async () => {
  const result = await execute('snapshot', { missingSchema: true });
  assert.equal(result.exitCode, 1);
  assert.equal(result.saved, undefined);
  assert.match(result.messages.join('\n'), /question.id/);
  assert.equal(result.calls.at(-1), 'destroy');
});

test('saves only row counts in a private file and verifies them after cutover', async () => {
  const snapshot = await execute('snapshot');
  assert.deepEqual(snapshot.saved, snapshot.counts);
  const result = await execute('verify');
  assert.equal(result.exitCode, 0);
  assert.match(result.messages.join('\n'), /SOURCE_DATABASE_VERIFIED/);
});

test('detects a changed question count without writing to the database', async () => {
  const result = await execute('verify', { changedCounts: true });
  assert.equal(result.exitCode, 1);
  assert.match(result.messages.join('\n'), /Unexpected row count change in question/);
  assert.equal(result.calls.at(-1), 'destroy');
});
