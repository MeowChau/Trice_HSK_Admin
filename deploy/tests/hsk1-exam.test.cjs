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
const { ExamsService } = require(path.join(root, 'backend/dist/exams/exams.service.js'));
const { publicExam } = require(path.join(root, 'backend/dist/exams/exam-view.js'));
const { loadBundle, snapshot, prepare, apply } = require('../replace-hsk1-exam.cjs');
const name = `exam_test_${randomUUID().replace(/-/g, '')}`;
const fixture = path.join(root, 'deploy/transfers', name);
let db, admin, bundle, examId, otherId, oldQuestionId, service, latestBackup;
let counter = 0;
const backup = () => path.join(fixture, `backup-${++counter}`);

before(async () => {
  if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL required.');
  let directory = process.env.TEST_EXAM_BUNDLE;
  if (!directory) {
    const source = path.join(root, 'backend/workbook-hsk1/release');
    const data = JSON.parse(fs.readFileSync(path.join(source, 'questions.json')));
    data.questions = data.questions.filter(q => q.payload.source.lesson === 0 && q.payload.source.section === 'mock-test');
    const names = new Set(data.questions.flatMap(q => [q.payload.imageUrl, q.payload.contextImageUrl, q.payload.continuationImageUrl, q.payload.source.scanUrl, ...(q.payload.optionImages || [])].filter(Boolean).map(url => url.slice('/api/v1/files/'.length))));
    data.assets = data.assets.filter(asset => names.has(asset.name));
    directory = path.join(fixture, 'bundle'); fs.mkdirSync(path.join(directory, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'questions.json'), JSON.stringify(data));
    for (const asset of data.assets) fs.copyFileSync(path.join(source, 'assets', asset.name), path.join(directory, 'assets', asset.name));
  }
  bundle = loadBundle(directory, validateAuthoredQuestion);
  admin = new DataSource({ type: 'postgres', url: process.env.TEST_DATABASE_URL, logging: false });
  await admin.initialize(); await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
  const url = new URL(process.env.TEST_DATABASE_URL); url.pathname = '/' + name;
  db = new DataSource({ type: 'postgres', url: url.toString(), logging: false, synchronize: false, entities: [path.join(root, 'backend/dist/**/*.entity.js')], migrations: [path.join(root, 'backend/dist/database/migrations/*.js')] });
  await db.initialize(); await db.runMigrations({ transaction: 'all' });
  const exams = db.getRepository('ExamEntity');
  examId = (await exams.save(exams.create({ title: 'HSK 1 before', hskLevel: 1 }))).id;
  otherId = (await exams.save(exams.create({ title: 'HSK 2 preserved', hskLevel: 2 }))).id;
  const questions = db.getRepository('QuestionEntity');
  oldQuestionId = (await questions.save(questions.create({ type: 'MULTIPLE_CHOICE', skill: 'READING', difficulty: 1, hskLevel: 1, payload: { text: 'Old sentinel', options: ['A', 'B'] }, correctAnswer: { answer: 'A' }, isGameQuestion: false }))).id;
  for (const id of [examId, otherId]) {
    const sections = db.getRepository('ExamSectionEntity');
    const section = await sections.save(sections.create({ examId: id, title: 'Old section', order: 1 }));
    await db.getRepository('ExamSectionQuestionEntity').insert({ sectionId: section.id, questionId: oldQuestionId, order: 1 });
    await db.query('INSERT INTO exam_question ("examId", "questionId", "order") VALUES ($1, $2, 1)', [id, oldQuestionId]);
  }
  await db.getRepository('UserEntity').insert({ email: 'preserved@example.test', username: 'preserved', provider: 'email' });
  await db.getRepository('VocabularyEntity').insert({ hanzi: '你', pinyin: 'nǐ', meaning: 'you', hskLevel: 1 });
  await db.getRepository('PracticeSetEntity').insert({ title: 'Preserved', topic: 'sentinel', skill: 'READING', hskLevel: 1 });
  const [{ id: setId }] = await db.query('SELECT id FROM practice_set');
  await db.getRepository('PracticeSetQuestionEntity').insert({ practiceSetId: setId, questionId: oldQuestionId, order: 1 });
  service = new ExamsService(db.getRepository('ExamEntity'), db.getRepository('ExamSectionEntity'), db.getRepository('ExamSectionQuestionEntity'));
  fs.mkdirSync(path.join(fixture, 'uploads'), { recursive: true });
  fs.writeFileSync(path.join(fixture, 'uploads/avatar.jpg'), 'preserved-avatar');
});
after(async () => {
  if (db?.isInitialized) await db.destroy();
  if (admin?.isInitialized) {
    if (/^exam_test_[a-f0-9]{32}$/.test(name)) await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.destroy();
  }
});

test('book mock has exactly 1–40, 20 unknown listening answers and 20 derived reading keys', () => {
  assert.deepEqual(bundle.data.questions.map(q => q.payload.source.item), Array.from({ length: 40 }, (_, i) => i + 1));
  assert.ok(bundle.data.questions.slice(0, 20).every(q => q.skill === 'LISTENING' && q.correctAnswer === null && !q.payload.audioUrl));
  assert.equal(bundle.data.questions.slice(20).map(q => q.correctAnswer.answer).join(''), 'BDACFCAEBDCEABFCBCCB');
  assert.ok(bundle.assets.size > 40);
});
test('a damaged extracted image is rejected before any database work', () => {
  const damaged = path.join(fixture, 'damaged'); fs.mkdirSync(path.join(damaged, 'assets'), { recursive: true });
  fs.copyFileSync(path.join(bundle.directory, 'questions.json'), path.join(damaged, 'questions.json'));
  fs.writeFileSync(path.join(damaged, 'assets', bundle.data.assets[0].name), 'corrupted image');
  assert.throws(() => loadBundle(damaged), /Asset checksum mismatch/);
});
test('ambiguous HSK 1 selection aborts and requires an explicit existing ID', async () => {
  const exams = db.getRepository('ExamEntity');
  const duplicate = await exams.save(exams.create({ title: 'HSK 1 duplicate', hskLevel: 1 }));
  try {
    await assert.rejects(prepare(db, bundle, backup()), /Choose one/);
    assert.equal((await prepare(db, bundle, backup(), examId)).examId, examId);
    await assert.rejects(prepare(db, bundle, backup(), otherId), /Choose one/);
  } finally { await exams.delete(duplicate.id); }
});
test('concurrent edit after preparation cannot be overwritten', async () => {
  const target = backup(); await prepare(db, bundle, target);
  await db.getRepository('ExamEntity').update(examId, { title: 'Concurrent edit' });
  const before = await snapshot(db.manager, examId, bundle.data.sourcePdfSha256);
  await assert.rejects(apply(db, bundle, target, path.join(fixture, 'uploads')), /changed after backup/);
  assert.equal((await snapshot(db.manager, examId, bundle.data.sourcePdfSha256)).fingerprint, before.fingerprint);
});
test('failure halfway through replacement rolls back question inserts and deleted sections', async () => {
  const target = backup(); await prepare(db, bundle, target);
  const before = await snapshot(db.manager, examId, bundle.data.sourcePdfSha256);
  await db.query("ALTER TABLE exam_section ADD CONSTRAINT exam_test_failure CHECK (title <> 'Đọc · Câu 21–40')");
  try { await assert.rejects(apply(db, bundle, target, path.join(fixture, 'uploads')), /exam_test_failure/); }
  finally { await db.query('ALTER TABLE exam_section DROP CONSTRAINT exam_test_failure'); }
  assert.equal((await snapshot(db.manager, examId, bundle.data.sourcePdfSha256)).fingerprint, before.fingerprint);
  assert.equal(await db.getRepository('QuestionEntity').count(), 1);
  assert.equal(await db.getRepository('FileEntity').count(), 0);
  assert.equal(fs.existsSync(path.join(target, 'exam-imported.json')), false);
});
test('replacement keeps the exam ID, other exams, bank, practice links, users and uploads', async () => {
  const other = await snapshot(db.manager, otherId, bundle.data.sourcePdfSha256);
  latestBackup = backup(); await prepare(db, bundle, latestBackup);
  const report = await apply(db, bundle, latestBackup, path.join(fixture, 'uploads'));
  assert.equal(report.examId, examId); assert.equal(report.questions, 40); assert.equal(report.addedQuestions, 40);
  const current = await service.getDetails(examId);
  assert.deepEqual(current.sections.map(s => s.sectionQuestions.length), [20, 20]);
  assert.deepEqual(current.sections.flatMap(s => s.sectionQuestions.map(l => l.question.payload.source.item)), Array.from({ length: 40 }, (_, i) => i + 1));
  const preserved = await snapshot(db.manager, otherId, bundle.data.sourcePdfSha256);
  for (const key of ['exam', 'sections', 'links', 'legacy']) assert.deepEqual(preserved[key], other[key]);
  assert.equal(await db.getRepository('QuestionEntity').count(), 41);
  assert.ok(await db.getRepository('QuestionEntity').findOneBy({ id: oldQuestionId }));
  for (const table of ['user', 'vocabulary', 'practice_set', 'practice_set_question']) assert.equal((await db.query(`SELECT count(*)::int AS count FROM "${table}"`))[0].count, 1);
  assert.equal(fs.readFileSync(path.join(fixture, 'uploads/avatar.jpg'), 'utf8'), 'preserved-avatar');
  assert.ok(fs.existsSync(path.join(latestBackup, 'exam-before.json')));
});
test('repeat import reuses the 40 IDs and preserves admin audio and answer edits', async () => {
  const current = await service.getDetails(examId);
  const id = current.sections[0].sectionQuestions[0].questionId;
  await db.getRepository('ExamSectionEntity').update(current.sections[0].id, { audioUrl: '/api/v1/files/admin-section-recording.mp3' });
  const question = await db.getRepository('QuestionEntity').findOneByOrFail({ id });
  await db.getRepository('QuestionEntity').update(id, { payload: { ...question.payload, audioUrl: '/api/v1/files/admin-recording.mp3', reviewRequired: false }, correctAnswer: { answer: 'A' } });
  const target = backup(); await prepare(db, bundle, target);
  const report = await apply(db, bundle, target, path.join(fixture, 'uploads'));
  assert.equal(report.addedQuestions, 0); assert.equal(await db.getRepository('QuestionEntity').count(), 41);
  const edited = await db.getRepository('QuestionEntity').findOneByOrFail({ id });
  assert.equal(edited.payload.audioUrl, '/api/v1/files/admin-recording.mp3');
  assert.equal(edited.correctAnswer.answer, 'A');
  assert.equal((await service.getDetails(examId)).sections[0].audioUrl, '/api/v1/files/admin-section-recording.mp3');
});
function editInput(exam) {
  return { title: exam.title, description: exam.description, hskLevel: exam.hskLevel, updatedAt: exam.updatedAt.toISOString(), sections: exam.sections.map(s => ({ id: s.id, title: s.title, order: s.order, audioUrl: s.audioUrl, questions: s.sectionQuestions.map(l => ({ questionId: l.questionId, order: l.order })) })) };
}
test('admin edit changes title, section audio and order atomically; public exam excludes answers', async () => {
  const exam = await service.getDetails(examId);
  const data = editInput(exam); data.title = 'Edited exam'; data.sections[0].audioUrl = '/api/v1/files/shared-audio.mp3';
  [data.sections[1].questions[0].order, data.sections[1].questions[1].order] = [data.sections[1].questions[1].order, data.sections[1].questions[0].order];
  const updated = await service.update(examId, data);
  assert.equal(updated.title, 'Edited exam'); assert.equal(updated.sections[0].audioUrl, '/api/v1/files/shared-audio.mp3');
  assert.equal(updated.sections[1].sectionQuestions[0].questionId, exam.sections[1].sectionQuestions[1].questionId);
  const visible = publicExam(updated);
  assert.ok(!JSON.stringify(visible).includes('correctAnswer'));
  assert.ok(!JSON.stringify(visible).includes('ocrText'));
  assert.ok(visible.sections[1].sectionQuestions[0].question.payload.imageUrl);
  await assert.rejects(service.update(examId, data), error => error.status === 409);
});
test('foreign section, missing question and duplicate links fail without changing the exam', async () => {
  const current = await service.getDetails(examId);
  const foreign = await service.getDetails(otherId);
  for (const kind of ['foreign', 'missing', 'duplicate', 'order']) {
    const data = editInput(current);
    if (kind === 'foreign') data.sections[0].id = foreign.sections[0].id;
    if (kind === 'missing') data.sections[0].questions[0].questionId = 2147483647;
    if (kind === 'duplicate') data.sections[1].questions[0].questionId = data.sections[0].questions[0].questionId;
    if (kind === 'order') data.sections[1].questions[1].order = data.sections[1].questions[0].order;
    await assert.rejects(service.update(examId, data), error => error.status === 400);
    assert.deepEqual(editInput(await service.getDetails(examId)), editInput(current));
  }
});
test('database failure during admin editing rolls back already changed sections and links', async () => {
  const current = await service.getDetails(examId);
  const data = editInput(current); data.sections[0].title = 'Changed first section'; data.sections[1].title = 'Forbidden section';
  await db.query("ALTER TABLE exam_section ADD CONSTRAINT exam_test_edit_failure CHECK (title <> 'Forbidden section')");
  try { await assert.rejects(service.update(examId, data), /exam_test_edit_failure/); }
  finally { await db.query('ALTER TABLE exam_section DROP CONSTRAINT exam_test_edit_failure'); }
  assert.deepEqual(editInput(await service.getDetails(examId)), editInput(current));
});
