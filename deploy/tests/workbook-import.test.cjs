'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
require(path.join(root, 'backend/node_modules/reflect-metadata'));
const { DataSource } = require(path.join(root, 'backend/node_modules/typeorm'));
const { validateAuthoredQuestion } = require(path.join(root, 'backend/dist/questions/question-validation.js'));
const { QuestionsService } = require(path.join(root, 'backend/dist/questions/questions.service.js'));
const { loadBundle, snapshot, prepare, apply, restore } = require('../rebuild-hsk1-workbook.cjs');
const databaseName = `workbook_test_${randomUUID().replace(/-/g, '')}`;
const directory = path.join(root, 'backend/workbook-hsk1/release');
const fixture = path.join(root, 'deploy/transfers', databaseName);
const uploads = path.join(fixture, 'uploads');
let admin, db, bundle;
let backupNumber = 0;
const backup = () => path.join(fixture, `backup-${++backupNumber}`);

before(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required.');
  admin = new DataSource({ type: 'postgres', url: process.env.TEST_DATABASE_URL, logging: false });
  await admin.initialize();
  await admin.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0`);
  const url = new URL(process.env.TEST_DATABASE_URL); url.pathname = `/${databaseName}`;
  db = new DataSource({ type: 'postgres', url: url.toString(), logging: false, synchronize: false, entities: [path.join(root, 'backend/dist/**/*.entity.js')], migrations: [path.join(root, 'backend/dist/database/migrations/*.js')] });
  await db.initialize(); await db.runMigrations({ transaction: 'all' });
  await db.getRepository('UserEntity').insert({ email: 'preserved@example.test', username: 'preserved-user', provider: 'email' });
  await db.getRepository('VocabularyEntity').insert({ hanzi: '你', pinyin: 'nǐ', meaning: 'you', hskLevel: 1 });
  await db.getRepository('ExamEntity').insert({ title: 'Preserved exam', hskLevel: 1 });
  const [{ id: examId }] = await db.query('SELECT id FROM exam');
  await db.getRepository('ExamSectionEntity').insert({ examId, title: 'Preserved section', order: 1 });
  await db.getRepository('PracticeSetEntity').insert({ title: 'Preserved practice', topic: 'sentinel', skill: 'READING', hskLevel: 1 });
  fs.mkdirSync(uploads, { recursive: true });
  fs.writeFileSync(path.join(uploads, 'preserved-avatar.jpg'), 'sentinel-avatar');
  bundle = loadBundle(directory, validateAuthoredQuestion);
});
after(async () => {
  if (db?.isInitialized) await db.destroy();
  if (admin?.isInitialized) {
    if (/^workbook_test_[a-f0-9]{32}$/.test(databaseName)) await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.destroy();
  }
});
async function oldBank() {
  await db.query('DELETE FROM question');
  await db.getRepository('QuestionEntity').insert({ type: 'MULTIPLE_CHOICE', skill: 'READING', difficulty: 1, hskLevel: 1, payload: { text: 'Old question sentinel' }, correctAnswer: { answer: 'A' }, isGameQuestion: false });
  const [{ id: questionId }] = await db.query('SELECT id FROM question');
  const [{ id: sectionId }] = await db.query('SELECT id FROM exam_section');
  const [{ id: practiceSetId }] = await db.query('SELECT id FROM practice_set');
  await db.getRepository('ExamSectionQuestionEntity').insert({ sectionId, questionId, order: 1 });
  await db.getRepository('PracticeSetQuestionEntity').insert({ practiceSetId, questionId, order: 1 });
  const [{ id: examId }] = await db.query('SELECT id FROM exam');
  await db.query('INSERT INTO exam_question ("examId", "questionId", "order") VALUES ($1, $2, 1)', [examId, questionId]);
}
test('verified workbook covers all lessons, keeps unknown listening answers, and rejects a damaged asset', async () => {
  assert.equal(bundle.data.questions.length, 367);
  assert.deepEqual([...new Set(bundle.data.questions.map(q => q.payload.source.lesson))].sort((a,b) => a-b), Array.from({ length: 16 }, (_, i) => i));
  assert.equal(bundle.data.questions.filter(q => q.skill === 'READING' && q.correctAnswer?.answer).length, 140);
  assert.ok(bundle.data.questions.filter(q => q.skill === 'LISTENING').every(q => !q.payload.audioUrl && !q.correctAnswer));
  for (const lesson of [0, ...Array.from({ length: 12 }, (_, index) => index + 4)]) {
    const numbers = bundle.data.questions.filter(q => q.payload.source.lesson === lesson && q.payload.source.section !== 'guided-practice').map(q => q.payload.source.item).sort((a,b) => a-b);
    assert.deepEqual(numbers, Array.from({ length: lesson ? 20 : 40 }, (_, index) => index + 1));
  }
  const guided = bundle.data.questions.filter(q => q.payload.source.section === 'guided-practice');
  assert.equal(guided.length, 87);
  assert.equal(guided.filter(q => q.skill === 'WRITING').length, 21);
  assert.ok(bundle.data.questions.filter(q => q.payload.source.lesson > 0 && q.payload.templateId === 'listen-image-matching').every(q => q.payload.options.join('') === 'ABCD'));
  assert.deepEqual(guided.filter(q => q.payload.continuationImageUrl).map(q => q.payload.source.continuedOnPdfPages[0]).sort(), [111, 119]);
  const damaged = path.join(fixture, 'damaged'); fs.mkdirSync(path.join(damaged, 'assets'), { recursive: true });
  fs.copyFileSync(path.join(directory, 'questions.json'), path.join(damaged, 'questions.json'));
  fs.writeFileSync(path.join(damaged, 'assets', bundle.data.assets[0].name), 'broken');
  assert.throws(() => loadBundle(damaged, validateAuthoredQuestion), /checksum mismatch/);
});
test('preparation backs up every old question/link without changing the live bank', async () => {
  await oldBank(); const before = await snapshot(db.manager); const target = backup();
  const report = await prepare(db, bundle, target);
  assert.equal(report.oldQuestions, 1); assert.equal(report.oldExamLinks, 1); assert.equal(report.oldPracticeLinks, 1);
  assert.equal((await snapshot(db.manager)).fingerprint, before.fingerprint);
  const receipt = JSON.parse(fs.readFileSync(path.join(target, 'questions-before.json')));
  assert.equal(receipt.rows.question[0].payload.text, 'Old question sentinel');
});
test('an unexpected history dependency aborts before any question can be removed', async () => {
  await oldBank(); const before = await snapshot(db.manager);
  await db.query('CREATE TABLE workbook_test_history_dependency (id int PRIMARY KEY, "questionId" int REFERENCES question(id) ON DELETE CASCADE)');
  try { await assert.rejects(prepare(db, bundle, backup()), /Unexpected question dependencies/); }
  finally { await db.query('DROP TABLE workbook_test_history_dependency'); }
  assert.equal((await snapshot(db.manager)).fingerprint, before.fingerprint);
});
test('a concurrent edit after backup aborts before deleting old questions or links', async () => {
  await oldBank(); const target = backup(); await prepare(db, bundle, target);
  await db.query("UPDATE question SET payload = '{\"text\":\"Edited after backup\"}'::jsonb");
  const before = await snapshot(db.manager);
  await assert.rejects(apply(db, bundle, target, uploads), /changed after backup/);
  assert.equal((await snapshot(db.manager)).fingerprint, before.fingerprint);
});
test('an insertion failure rolls back deleted questions, cascaded links and file rows', async () => {
  await oldBank(); const target = backup(); await prepare(db, bundle, target);
  const before = await snapshot(db.manager), oldFiles = await db.getRepository('FileEntity').count();
  await db.query("ALTER TABLE question ADD CONSTRAINT workbook_test_reject_writing CHECK (skill <> 'WRITING')");
  try { await assert.rejects(apply(db, bundle, target, uploads), /workbook_test_reject_writing/); }
  finally { await db.query('ALTER TABLE question DROP CONSTRAINT workbook_test_reject_writing'); }
  assert.equal((await snapshot(db.manager)).fingerprint, before.fingerprint);
  assert.equal(await db.getRepository('FileEntity').count(), oldFiles);
  assert.equal(fs.existsSync(path.join(target, 'questions-imported.json')), false);
});
test('replacement commits 367 questions, preserves unrelated rows/uploads and supports real query filters', async () => {
  await oldBank(); const target = backup(); await prepare(db, bundle, target);
  const report = await apply(db, bundle, target, uploads);
  assert.equal(report.questions, 367); assert.equal(report.detachedExamLinks, 1); assert.equal(report.detachedPracticeLinks, 1);
  assert.equal(report.detachedLegacyExamLinks, 1);
  assert.deepEqual(report.preserved, { user: 1, vocabulary: 1, exam: 1, exam_section: 1, practice_set: 1 });
  assert.equal(fs.readFileSync(path.join(uploads, 'preserved-avatar.jpg'), 'utf8'), 'sentinel-avatar');
  assert.equal(await db.getRepository('FileEntity').count(), 805);
  const questions = new QuestionsService(db.getRepository('QuestionEntity'), { record() {} });
  assert.equal((await questions.findWithPagination({ sourceLesson: 0 })).total, 40);
  assert.equal((await questions.findWithPagination({ preparation: 'ready' })).total, 140);
  const waiting = await questions.findWithPagination({ preparation: 'needs_audio' });
  assert.ok(waiting.total > 140); assert.ok(waiting.data.every(q => q.skill === 'LISTENING'));
  const all = await questions.findWithPagination({ page: 2, limit: 10 });
  assert.equal(all.page, 2); assert.equal(all.data.length, 10);
  const restored = await restore(db, target);
  assert.equal(restored.questions, 1); assert.equal(restored.examLinks, 1); assert.equal(restored.practiceLinks, 1); assert.equal(restored.legacyExamLinks, 1);
  assert.equal((await db.getRepository('QuestionEntity').find())[0].payload.text, 'Old question sentinel');
  assert.equal(fs.readFileSync(path.join(uploads, 'preserved-avatar.jpg'), 'utf8'), 'sentinel-avatar');
});
test('restoration refuses to overwrite edits made after the replacement', async () => {
  await oldBank(); const target = backup(); await prepare(db, bundle, target); await apply(db, bundle, target, uploads);
  await db.query('UPDATE question SET payload = payload || $1::jsonb WHERE id = (SELECT min(id) FROM question)', [JSON.stringify({ text: 'Author edit after import' })]);
  const before = await snapshot(db.manager);
  await assert.rejects(restore(db, target), /changed since import/);
  assert.equal((await snapshot(db.manager)).fingerprint, before.fingerprint);
});
