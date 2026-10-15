'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const prefix = '/api/v1/files/';

function loadBundle(directory, validate = () => {}) {
  const bytes = fs.readFileSync(path.join(directory, 'questions.json'));
  const data = JSON.parse(bytes);
  if (data.formatVersion !== 1 || data.questions?.length !== 40 || !/^[a-f0-9]{64}$/.test(data.sourcePdfSha256 || '') || data.audioIncluded !== false || data.answerKeyIncluded !== false) throw Error('Invalid mock exam manifest.');
  const assets = new Map();
  for (const asset of data.assets) {
    if (!/^hsk1-workbook-[a-f0-9]{12}-[a-zA-Z0-9-]+\.webp$/.test(asset.name) || assets.has(asset.name)) throw Error('Unsafe asset name.');
    const file = path.join(directory, 'assets', asset.name);
    if (fs.lstatSync(file).isSymbolicLink()) throw Error('Symlink asset rejected.');
    const content = fs.readFileSync(file);
    if (hash(content) !== asset.sha256 || content.length !== asset.size) throw Error(`Asset checksum mismatch: ${asset.name}`);
    assets.set(asset.name, asset);
  }
  const numbers = new Set();
  for (const question of data.questions) {
    validate(question);
    const p = question.payload, s = p?.source;
    if (question.hskLevel !== 1 || s?.lesson !== 0 || s.section !== 'mock-test' || s.pdfSha256 !== data.sourcePdfSha256 || !Number.isInteger(s.item) || s.item < 1 || s.item > 40 || numbers.has(s.item) || question.skill !== (s.item <= 20 ? 'LISTENING' : 'READING')) throw Error('Invalid mock question provenance/order.');
    numbers.add(s.item);
    if (s.item <= 20 ? question.correctAnswer !== null || !!p.audioUrl : !/^[A-F]$/.test(question.correctAnswer?.answer || '')) throw Error('Invalid answer provenance.');
    for (const url of [p.imageUrl, p.contextImageUrl, p.continuationImageUrl, s.scanUrl, ...(p.optionImages || [])].filter(Boolean)) {
      if (!url.startsWith(prefix) || !assets.has(url.slice(prefix.length))) throw Error('Unverified image reference.');
    }
    if (!p.imageUrl) throw Error('Original crop missing.');
  }
  data.questions.sort((a, b) => a.payload.source.item - b.payload.source.item);
  return { data, assets, directory, digest: hash(bytes) };
}

async function selectExam(manager, requestedId) {
  const exams = await manager.query('SELECT id, title FROM exam WHERE "hskLevel" = 1 AND "deletedAt" IS NULL ORDER BY id');
  const selected = requestedId ? exams.find(exam => exam.id === requestedId) : exams.length === 1 ? exams[0] : null;
  if (!selected) throw Error(`Choose one existing HSK 1 exam with --exam-id. Candidates: ${JSON.stringify(exams)}`);
  return selected.id;
}
async function snapshot(manager, id, pdfHash) {
  const [{ name: database }] = await manager.query('SELECT current_database() AS name');
  const exam = await manager.query('SELECT * FROM exam WHERE id = $1', [id]);
  const sections = await manager.query('SELECT * FROM exam_section WHERE "examId" = $1 ORDER BY id', [id]);
  const links = await manager.query('SELECT l.* FROM exam_section_question l JOIN exam_section s ON s.id=l."sectionId" WHERE s."examId"=$1 ORDER BY l."sectionId", l."order", l."questionId"', [id]);
  const [{ relation }] = await manager.query("SELECT to_regclass('public.exam_question')::text AS relation");
  const legacy = relation ? await manager.query('SELECT * FROM exam_question WHERE "examId"=$1 ORDER BY "order", "questionId"', [id]) : [];
  const questions = await manager.query('SELECT * FROM question WHERE "deletedAt" IS NULL AND payload->\'source\'->>\'pdfSha256\'=$1 AND payload->\'source\'->>\'section\'=\'mock-test\' AND payload->\'source\'->>\'lesson\'=\'0\' ORDER BY id', [pdfHash]);
  const state = { database, id, exam, sections, links, legacy, questions };
  return { ...state, fingerprint: hash(JSON.stringify(state)) };
}
async function prepare(db, bundle, backup, requestedId) {
  const before = await db.transaction(async manager => {
    await manager.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    return snapshot(manager, await selectExam(manager, requestedId), bundle.data.sourcePdfSha256);
  });
  fs.mkdirSync(backup, { recursive: true });
  fs.writeFileSync(path.join(backup, 'exam-before.json'), JSON.stringify({ ...before, datasetSha256: bundle.digest }, null, 2), { flag: 'wx', mode: 0o600 });
  return { examId: before.id, title: before.exam[0].title, previousQuestions: before.links.length, newQuestions: 40, listeningAudio: 'awaiting-author-upload' };
}
async function apply(db, bundle, backup, uploads) {
  const receipt = JSON.parse(fs.readFileSync(path.join(backup, 'exam-before.json')));
  if (receipt.datasetSha256 !== bundle.digest) throw Error('Dataset changed since preparation.');
  fs.mkdirSync(uploads, { recursive: true });
  for (const asset of bundle.assets.values()) {
    const target = path.join(uploads, asset.name);
    if (fs.existsSync(target)) {
      if (fs.lstatSync(target).isSymbolicLink() || hash(fs.readFileSync(target)) !== asset.sha256) throw Error(`Existing upload differs: ${asset.name}`);
    } else fs.copyFileSync(path.join(bundle.directory, 'assets', asset.name), target, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(target, 0o644);
  }
  const report = await db.transaction(async manager => {
    await manager.query("SET LOCAL lock_timeout = '10s'");
    await manager.query('LOCK TABLE exam, exam_section, exam_section_question, question IN SHARE ROW EXCLUSIVE MODE');
    const [{ relation }] = await manager.query("SELECT to_regclass('public.exam_question')::text AS relation");
    if (relation) await manager.query('LOCK TABLE exam_question IN SHARE ROW EXCLUSIVE MODE');
    const before = await snapshot(manager, receipt.id, bundle.data.sourcePdfSha256);
    if (before.fingerprint !== receipt.fingerprint) throw Error('Exam/questions changed after backup; replacement aborted.');
    const repository = manager.getRepository('QuestionEntity');
    const selected = [];
    let added = 0;
    for (const question of bundle.data.questions) {
      const matches = before.questions.filter(q => q.payload.source.item === question.payload.source.item);
      if (matches.length > 1) throw Error('Duplicate workbook source questions; replacement aborted.');
      if (matches.length) {
        const found = matches[0];
        if (found.hskLevel !== 1 || found.skill !== question.skill) throw Error('Workbook question level/skill differs.');
        // Reuse IDs and retain any audio/answer edits already supplied by admin.
        selected.push(found);
      } else { selected.push(await repository.save(repository.create(question))); added++; }
    }
    const files = manager.getRepository('FileEntity');
    const paths = new Set((await manager.query('SELECT path FROM file')).map(row => row.path));
    for (const asset of bundle.assets.values()) if (!paths.has(prefix + asset.name)) await files.insert({ id: crypto.randomUUID(), path: prefix + asset.name });
    await manager.query('DELETE FROM exam_section WHERE "examId"=$1', [receipt.id]);
    if (relation) await manager.query('DELETE FROM exam_question WHERE "examId"=$1', [receipt.id]);
    const sections = manager.getRepository('ExamSectionEntity');
    const links = manager.getRepository('ExamSectionQuestionEntity');
    for (let part = 0; part < 2; part++) {
      const partIds = new Set(selected.slice(part * 20, part * 20 + 20).map(q => q.id));
      const previous = before.sections.find(section => {
        const oldLinks = before.links.filter(link => link.sectionId === section.id);
        return oldLinks.length === 20 && oldLinks.every(link => partIds.has(link.questionId));
      });
      const section = await sections.save(sections.create({ examId: receipt.id, title: part === 0 ? 'Nghe · Câu 1–20' : 'Đọc · Câu 21–40', order: part + 1, audioUrl: previous?.audioUrl ?? null }));
      await links.insert(selected.slice(part * 20, part * 20 + 20).map((q, index) => ({ sectionId: section.id, questionId: q.id, order: index + 1 })));
    }
    await manager.getRepository('ExamEntity').update(receipt.id, { title: 'HSK 1 · Đề thi mẫu cuối sách bài tập', description: '40 câu: 20 nghe, 20 đọc. Đề gốc từ sách 新HSK教程1 学练手册, trang PDF 128–137. Phần nghe cần admin bổ sung audio và đáp án; phần đọc có đáp án đối chiếu từ đề gốc (sách scan không kèm đáp án).' });
    const after = await snapshot(manager, receipt.id, bundle.data.sourcePdfSha256);
    if (after.sections.length !== 2 || after.links.length !== 40 || new Set(after.links.map(link => link.questionId)).size !== 40) throw Error('Exam verification failed.');
    await manager.getRepository('AuditLogEntity').insert({ userId: null, userName: 'Workbook exam import', action: 'REPLACE', entityType: 'EXAM', entityId: String(receipt.id), summary: 'Replaced HSK 1 exam with 40 original workbook mock questions.', oldData: { title: before.exam[0].title, questions: before.links.length }, newData: { questions: 40, addedQuestions: added, sourcePdfSha256: bundle.data.sourcePdfSha256 }, changedFields: ['title', 'description', 'sections'] });
    return { examId: receipt.id, questions: 40, sections: 2, addedQuestions: added, fingerprint: after.fingerprint };
  });
  fs.writeFileSync(path.join(backup, 'exam-imported.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  return report;
}

async function main() {
  const mode = process.argv[2];
  const directory = process.env.EXAM_DIRECTORY || '/exam';
  if (mode === 'verify-files') { const bundle = loadBundle(directory); console.log(`MOCK_EXAM_FILES_OK: 40 questions, ${bundle.assets.size} verified assets.`); return; }
  const appRequire = createRequire(path.join(process.env.WORKBOOK_APP_ROOT || '/app', 'package.json'));
  const { validateAuthoredQuestion } = appRequire('./dist/questions/question-validation.js');
  const bundle = loadBundle(directory, validateAuthoredQuestion);
  if (mode === 'verify') { console.log('MOCK_EXAM_VALIDATION_OK'); return; }
  if (!['prepare', 'replace'].includes(mode)) throw Error('Use verify-files, verify, prepare or replace.');
  const { AppDataSource: db } = appRequire('./dist/database/data-source.js');
  db.setOptions({ synchronize: false, dropSchema: false, migrationsRun: false, logging: false, extra: { ...db.options.extra, max: 2 } });
  await db.initialize();
  try {
    const [{ name }] = await db.query('SELECT current_database() AS name');
    if (process.env.EXPECTED_DATABASE && name !== process.env.EXPECTED_DATABASE) throw Error('Compose database differs from the running API database; stopped.');
    const requestedId = process.env.EXAM_ID ? Number(process.env.EXAM_ID) : undefined;
    if (requestedId !== undefined && (!Number.isSafeInteger(requestedId) || requestedId < 1)) throw Error('Invalid exam ID.');
    const report = mode === 'prepare' ? await prepare(db, bundle, '/backup', requestedId) : await apply(db, bundle, '/backup', '/app/files');
    console.log((mode === 'prepare' ? 'HSK1_EXAM_PREPARED: ' : 'HSK1_MOCK_EXAM_REPLACED: ') + JSON.stringify(report));
  } finally { await db.destroy(); }
}
module.exports = { loadBundle, snapshot, prepare, apply };
if (require.main === module) main().catch(error => { console.error('MOCK_EXAM_FAILED: ' + error.message); process.exitCode = 1; });
