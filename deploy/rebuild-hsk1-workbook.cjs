'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const preservedTables = ['user', 'vocabulary', 'exam', 'exam_section', 'practice_set'];
const linkedTables = ['exam_section_question', 'practice_set_question', 'exam_question'];
const uploadsPrefix = '/api/v1/files/';

function loadBundle(directory, validate) {
  const bytes = fs.readFileSync(path.join(directory, 'questions.json'));
  const data = JSON.parse(bytes);
  if (data.formatVersion !== 1 || data.sourcePdfPages !== 139 || data.coreQuestions !== 280 || data.questions?.length !== 367 || !/^[a-f0-9]{64}$/.test(data.sourcePdfSha256 || '')) throw new Error('Unexpected workbook dataset.');
  if (data.audioIncluded !== false || data.answerKeyIncluded !== false) throw new Error('Unexpected source provenance.');
  const assets = new Map();
  for (const asset of data.assets || []) {
    if (!/^hsk1-workbook-[a-f0-9]{12}-[a-zA-Z0-9-]+\.webp$/.test(asset.name) || assets.has(asset.name)) throw new Error('Unsafe or duplicate asset name.');
    const file = path.join(directory, 'assets', asset.name);
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Symlink assets are not accepted.');
    const content = fs.readFileSync(file);
    const actual = hash(content);
    if (content.length !== asset.size || actual !== asset.sha256) throw new Error(`Asset checksum mismatch: ${asset.name}; expected ${asset.sha256} (${asset.size} bytes), found ${actual} (${content.length} bytes).`);
    assets.set(asset.name, asset);
  }
  const sourceItems = new Set();
  let readingAnswers = 0, core = 0;
  for (const question of data.questions) {
    validate(question);
    const p = question.payload, s = p?.source;
    if (question.hskLevel !== 1 || question.difficulty !== 1 || question.isGameQuestion !== false || p.schemaVersion !== 1 || s?.pdfSha256 !== data.sourcePdfSha256 || !Number.isInteger(s.pdfPage) || s.pdfPage < 8 || s.pdfPage > 137 || !Number.isInteger(s.lesson) || s.lesson < 0 || s.lesson > 15) throw new Error('Invalid question provenance.');
    const key = `${s.lesson}:${s.section}:${s.item}`;
    if (sourceItems.has(key)) throw new Error('Duplicate source question.');
    sourceItems.add(key);
    if (s.section !== 'guided-practice') core++;
    if (question.skill === 'READING' && question.correctAnswer?.answer) readingAnswers++;
    if (question.skill === 'LISTENING' && (p.audioUrl || question.correctAnswer)) throw new Error('Listening audio/answers must be supplied by the author.');
    for (const url of [p.imageUrl, p.contextImageUrl, p.continuationImageUrl, s.scanUrl, ...(p.optionImages || [])].filter(Boolean)) {
      if (!url.startsWith(uploadsPrefix) || !assets.has(url.slice(uploadsPrefix.length))) throw new Error('Question references an unverified asset.');
    }
    if (!p.imageUrl) throw new Error('Original question crop is missing.');
  }
  if (core !== 280 || readingAnswers !== 140 || assets.size !== 805) throw new Error('Incomplete workbook coverage.');
  return { data, assets, directory, digest: hash(bytes) };
}

async function snapshot(manager) {
  const [{ name }] = await manager.query('SELECT current_database() AS name');
  const rows = {};
  for (const table of ['question', ...linkedTables]) {
    const [{ relation }] = await manager.query('SELECT to_regclass($1)::text AS relation', [`public.${table}`]);
    if (!relation && table !== 'exam_question') throw new Error(`Missing required table: ${table}`);
    rows[table] = relation ? await manager.query(`SELECT * FROM "${table}" ORDER BY ${table === 'question' ? 'id' : '"questionId", "order"'}`) : [];
  }
  const preserved = {};
  for (const table of preservedTables) {
    const [{ count }] = await manager.query(`SELECT count(*) FROM "${table}"`);
    preserved[table] = Number(count);
  }
  const fks = await manager.query("SELECT conrelid::regclass::text AS table_name, confdeltype AS delete_action FROM pg_constraint WHERE contype = 'f' AND confrelid = 'question'::regclass ORDER BY conname");
  if (fks.some(fk => !linkedTables.includes(fk.table_name.replace(/^public\./, '')) || fk.delete_action !== 'c')) throw new Error('Unexpected question dependencies; replacement aborted.');
  return { database: name, rows, preserved, fingerprint: hash(JSON.stringify({ name, rows, preserved })) };
}

async function prepare(db, bundle, backupDirectory) {
  fs.mkdirSync(backupDirectory, { recursive: true });
  const current = await db.transaction(async manager => {
    await manager.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    return snapshot(manager);
  });
  const receipt = { formatVersion: 1, datasetSha256: bundle.digest, createdAt: new Date().toISOString(), ...current };
  const destination = path.join(backupDirectory, 'questions-before.json');
  fs.writeFileSync(destination, JSON.stringify(receipt, null, 2), { flag: 'wx', mode: 0o600 });
  return { database: current.database, oldQuestions: current.rows.question.length, oldExamLinks: current.rows.exam_section_question.length, oldPracticeLinks: current.rows.practice_set_question.length, newQuestions: 367, receipt: destination };
}

async function apply(db, bundle, backupDirectory, uploadsDirectory) {
  const receipt = JSON.parse(fs.readFileSync(path.join(backupDirectory, 'questions-before.json'), 'utf8'));
  if (receipt.datasetSha256 !== bundle.digest) throw new Error('Dataset changed after backup.');
  // Namespace is dedicated to this PDF. Copy only these verified assets, keeping
  // all avatars, original uploads and user-provided audio in the active volume.
  fs.mkdirSync(uploadsDirectory, { recursive: true });
  for (const asset of bundle.assets.values()) {
    const target = path.join(uploadsDirectory, asset.name);
    if (fs.existsSync(target)) {
      if (fs.lstatSync(target).isSymbolicLink() || hash(fs.readFileSync(target)) !== asset.sha256) throw new Error('Existing asset differs; replacement aborted.');
    } else fs.copyFileSync(path.join(bundle.directory, 'assets', asset.name), target, fs.constants.COPYFILE_EXCL);
    // The maintenance container may run as root. Only verified public workbook
    // images become readable by the API user; other uploads remain untouched.
    fs.chmodSync(target, 0o644);
  }
  const result = await db.transaction(async manager => {
    await manager.query('SET LOCAL lock_timeout = \'10s\'');
    await manager.query('LOCK TABLE "question", "exam_section_question", "practice_set_question" IN ACCESS EXCLUSIVE MODE');
    const [{ relation }] = await manager.query("SELECT to_regclass('public.exam_question')::text AS relation");
    if (relation) await manager.query('LOCK TABLE "exam_question" IN ACCESS EXCLUSIVE MODE');
    const before = await snapshot(manager);
    if (before.database !== receipt.database || before.fingerprint !== receipt.fingerprint) throw new Error('Database changed after backup. No questions were replaced.');
    await manager.query('DELETE FROM "question"');
    const repository = manager.getRepository('QuestionEntity');
    for (let index = 0; index < bundle.data.questions.length; index += 40) await repository.insert(bundle.data.questions.slice(index, index + 40));
    const existing = new Set((await manager.query('SELECT path FROM "file"')).map(row => row.path));
    const files = manager.getRepository('FileEntity');
    for (const asset of bundle.assets.values()) {
      const filePath = uploadsPrefix + asset.name;
      if (!existing.has(filePath)) await files.insert({ id: crypto.randomUUID(), path: filePath });
    }
    const after = await snapshot(manager);
    if (after.rows.question.length !== 367 || linkedTables.some(table => after.rows[table].length !== 0) || preservedTables.some(table => after.preserved[table] !== before.preserved[table])) throw new Error('Post-import verification failed.');
    await manager.getRepository('AuditLogEntity').insert({ userId: null, userName: 'Workbook import', action: 'REBUILD', entityType: 'QUESTION', entityId: bundle.data.sourcePdfSha256.slice(0, 12), summary: 'Replaced the question bank with 367 original HSK 1 workbook items.', oldData: { questions: before.rows.question.length, examLinks: before.rows.exam_section_question.length, practiceLinks: before.rows.practice_set_question.length }, newData: { questions: 367, sourcePdfSha256: bundle.data.sourcePdfSha256, readingAnswers: 140, listeningAudio: 'awaiting-author-upload' }, changedFields: ['questionBank'] });
    return { database: after.database, fingerprint: after.fingerprint, questions: 367, readingAnswers: 140, assets: bundle.assets.size, preserved: after.preserved, detachedExamLinks: before.rows.exam_section_question.length, detachedLegacyExamLinks: before.rows.exam_question.length, detachedPracticeLinks: before.rows.practice_set_question.length };
  });
  // Success marker is durable enough to distinguish a committed import from a
  // later web/health failure. A failed DB transaction never writes this marker.
  fs.writeFileSync(path.join(backupDirectory, 'questions-imported.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  return result;
}

async function restore(db, backupDirectory) {
  const receipt = JSON.parse(fs.readFileSync(path.join(backupDirectory, 'questions-before.json'), 'utf8'));
  const imported = JSON.parse(fs.readFileSync(path.join(backupDirectory, 'questions-imported.json'), 'utf8'));
  return db.transaction(async manager => {
    await manager.query('SET LOCAL lock_timeout = \'10s\'');
    await manager.query('LOCK TABLE "question", "exam_section_question", "practice_set_question" IN ACCESS EXCLUSIVE MODE');
    const [{ relation }] = await manager.query("SELECT to_regclass('public.exam_question')::text AS relation");
    if (relation) await manager.query('LOCK TABLE "exam_question" IN ACCESS EXCLUSIVE MODE');
    const current = await snapshot(manager);
    if (current.database !== receipt.database || current.fingerprint !== imported.fingerprint) throw new Error('Database changed since import. Automatic question restore is refused.');
    await manager.query('DELETE FROM "question"');
    // TypeORM's generated-column insert can omit an old serial ID. Restore it
    // explicitly, otherwise the backed-up question links cannot reference it.
    const columns = ['id', 'type', 'skill', 'difficulty', 'hskLevel', 'payload', 'correctAnswer', 'isGameQuestion', 'createdAt', 'updatedAt', 'deletedAt'];
    for (let i = 0; i < receipt.rows.question.length; i += 40) {
      const values = [], tuples = [];
      for (const row of receipt.rows.question.slice(i, i + 40)) tuples.push('(' + columns.map(column => {
        // PostgreSQL TIMESTAMP is read as a local Date by pg. Passing the JSON
        // UTC string back directly would shift its wall time on non-UTC hosts.
        const value = row[column];
        values.push(['createdAt', 'updatedAt', 'deletedAt'].includes(column) && value ? new Date(value) : value);
        return `$${values.length}`;
      }).join(',') + ')');
      await manager.query(`INSERT INTO question (${columns.map(column => `"${column}"`).join(',')}) VALUES ${tuples.join(',')}`, values);
    }
    for (const [table, entity] of [['exam_section_question', 'ExamSectionQuestionEntity'], ['practice_set_question', 'PracticeSetQuestionEntity']]) {
      if (receipt.rows[table].length) await manager.getRepository(entity).insert(receipt.rows[table]);
    }
    if (relation) for (const row of receipt.rows.exam_question || []) await manager.query('INSERT INTO exam_question ("examId", "questionId", "order") VALUES ($1, $2, $3)', [row.examId, row.questionId, row.order]);
    const restored = await snapshot(manager);
    if (restored.fingerprint !== receipt.fingerprint) {
      const different = Object.keys(restored.rows).filter(table => JSON.stringify(restored.rows[table]) !== JSON.stringify(receipt.rows[table]));
      const fields = Object.keys(receipt.rows.question[0] || {}).filter(key => JSON.stringify(receipt.rows.question[0][key]) !== JSON.stringify(restored.rows.question[0]?.[key]));
      throw new Error('Restored question bank did not match the backup: ' + different.join(', ') + '; fields: ' + fields.join(', '));
    }
    await manager.getRepository('AuditLogEntity').insert({ userId: null, userName: 'Workbook restore', action: 'RESTORE', entityType: 'QUESTION', entityId: 'bank', summary: 'Restored the previous question bank and question links from its backup.', newData: { questions: restored.rows.question.length }, changedFields: ['questionBank'] });
    return { questions: restored.rows.question.length, examLinks: restored.rows.exam_section_question.length, practiceLinks: restored.rows.practice_set_question.length, legacyExamLinks: restored.rows.exam_question.length };
  });
}

async function main() {
  const mode = process.argv[2] || 'verify';
  if (mode === 'verify-files') {
    // Built-in Node modules only: the currently running image can verify the
    // extracted archive before source changes, builds, or database access.
    loadBundle(process.env.WORKBOOK_DIRECTORY || '/workbook', () => {});
    console.log('WORKBOOK_ASSETS_VERIFIED: 367 items, 805 assets.');
    return;
  }
  const appRequire = createRequire(path.join(process.env.WORKBOOK_APP_ROOT || '/app', 'package.json'));
  const { validateAuthoredQuestion } = appRequire('./dist/questions/question-validation.js');
  const bundle = loadBundle(process.env.WORKBOOK_DIRECTORY || '/workbook', validateAuthoredQuestion);
  if (mode === 'verify') { console.log('WORKBOOK_FILES_OK: ' + JSON.stringify({ questions: 367, assets: 805, readingAnswers: 140 })); return; }
  if (!['prepare', 'replace-all', 'restore-questions'].includes(mode)) throw new Error('Use verify, prepare, replace-all, or restore-questions.');
  const { AppDataSource: db } = appRequire('./dist/database/data-source.js');
  db.setOptions({ synchronize: false, dropSchema: false, migrationsRun: false, logging: false, extra: { ...db.options.extra, max: 2 } });
  await db.initialize();
  try {
    const backup = process.env.WORKBOOK_BACKUP_DIRECTORY || '/backup';
    const result = mode === 'prepare' ? await prepare(db, bundle, backup) : mode === 'restore-questions' ? await restore(db, backup) : await apply(db, bundle, backup, process.env.WORKBOOK_UPLOADS_DIRECTORY || '/app/files');
    console.log((mode === 'prepare' ? 'WORKBOOK_REPLACEMENT_PREPARED: ' : mode === 'restore-questions' ? 'PREVIOUS_QUESTION_BANK_RESTORED: ' : 'HSK1_QUESTION_BANK_REBUILT: ') + JSON.stringify(result));
  } finally { await db.destroy(); }
}
module.exports = { loadBundle, snapshot, prepare, apply, restore };
if (require.main === module) main().catch(error => { console.error('WORKBOOK_REBUILD_FAILED: ' + (error.message || 'Import failed.')); process.exitCode = 1; });
