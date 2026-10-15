'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
require(path.join(root, 'backend/node_modules/reflect-metadata'));
const { DataSource } = require(path.join(root, 'backend/node_modules/typeorm'));
const { AnalyticsService } = require(path.join(root, 'backend/dist/analytics/analytics.service.js'));
const { QuestionsService } = require(path.join(root, 'backend/dist/questions/questions.service.js'));
const { ExamsService } = require(path.join(root, 'backend/dist/exams/exams.service.js'));
const { studyDate } = require(path.join(root, 'backend/dist/utils/study-date.js'));
const name = `refactor_test_${randomUUID().replace(/-/g, '')}`;
const queries = [];
const logger = { logQuery: query => queries.push(query), logQueryError() {}, logQuerySlow() {}, logSchemaBuild() {}, logMigration() {}, log() {} };
let admin, db, analytics, questions, exams, studentId, examId;
const day = offset => studyDate(new Date(Date.now() - offset * 86400000));

before(async () => {
  if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL required.');
  admin = new DataSource({ type: 'postgres', url: process.env.TEST_DATABASE_URL, logging: false });
  await admin.initialize(); await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
  const url = new URL(process.env.TEST_DATABASE_URL); url.pathname = '/' + name;
  db = new DataSource({ type: 'postgres', url: url.toString(), logging: ['query'], logger, synchronize: false, entities: [path.join(root, 'backend/dist/**/*.entity.js')], migrations: [path.join(root, 'backend/dist/database/migrations/*.js')] });
  await db.initialize(); await db.runMigrations({ transaction: 'all' });
  await db.query("INSERT INTO role(id,name) VALUES (1,'Admin'),(2,'Student'),(3,'Teacher') ON CONFLICT DO NOTHING");
  await db.query("INSERT INTO status(id,name) VALUES (1,'Active'),(2,'Inactive'),(3,'Pending') ON CONFLICT DO NOTHING");
  const users = db.getRepository('UserEntity');
  studentId = (await users.save(users.create({ email: 'student@example.test', username: 'student', role: { id: 2 }, status: { id: 1 } }))).id;
  const now = new Date();
  for (const [index, month, deleted] of [[0, 0, false], [1, 0, true], [2, -1, false]]) {
    await users.save(users.create({ email: `teacher${index}@example.test`, username: `teacher${index}`, fullName: `Teacher ${index}`, role: { id: 3 }, status: { id: 1 }, createdAt: new Date(now.getFullYear(), now.getMonth() + month, 10), deletedAt: deleted ? now : null, position: index === 2 ? 'Bậc 2' : 'Bậc 1' }));
  }
  const questionRepo = db.getRepository('QuestionEntity');
  const saved = [];
  for (const [index, month, skill, level, game, deleted] of [[0, 0, 'READING', 1, false, false], [1, -1, 'LISTENING', 1, true, false], [2, -7, 'WRITING', 2, false, false], [3, 0, 'READING', 1, true, true]]) {
    saved.push(await questionRepo.save(questionRepo.create({ type: 'MULTIPLE_CHOICE', skill, difficulty: 1, hskLevel: level, payload: { text: `Question ${index}` }, correctAnswer: { answer: 'A' }, isGameQuestion: game, createdAt: new Date(now.getFullYear(), now.getMonth() + month, 10), deletedAt: deleted ? now : null })));
  }
  const examRepo = db.getRepository('ExamEntity');
  examId = (await examRepo.save(examRepo.create({ title: 'HSK 1 primary', hskLevel: 1, createdAt: new Date(now.getFullYear(), now.getMonth(), 10) }))).id;
  await examRepo.save(examRepo.create({ title: 'HSK 2 other', hskLevel: 2, createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 10) }));
  await examRepo.save(examRepo.create({ title: 'Deleted exam', hskLevel: 1, deletedAt: now }));
  const sectionRepo = db.getRepository('ExamSectionEntity');
  const section = await sectionRepo.save(sectionRepo.create({ examId, title: 'Reading', order: 1 }));
  const second = await sectionRepo.save(sectionRepo.create({ examId, title: 'Listening', order: 2 }));
  await db.getRepository('ExamSectionQuestionEntity').insert([{ sectionId: section.id, questionId: saved[0].id, order: 1 }, { sectionId: second.id, questionId: saved[1].id, order: 1 }]);
  await db.getRepository('PracticeSetEntity').insert({ title: 'Practice', topic: 'sentinel', skill: 'READING', hskLevel: 1, createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 10) });
  for (const [date, duration] of [[day(0), 3600], [day(0), 1800], [day(1), 3600], [day(6), 1800], [day(12), 10800]]) await db.getRepository('StudySessionLogEntity').insert({ user: { id: studentId }, studyDate: date, durationInSeconds: duration, module: 'reading' });
  const repo = entity => db.getRepository(entity);
  analytics = new AnalyticsService(repo('StudySessionLogEntity'), repo('UserEntity'), repo('QuestionEntity'), repo('ExamEntity'), repo('PracticeSetEntity'));
  questions = new QuestionsService(repo('QuestionEntity'), { record() {} });
  exams = new ExamsService(repo('ExamEntity'), repo('ExamSectionEntity'), repo('ExamSectionQuestionEntity'));
});
after(async () => {
  if (db?.isInitialized) await db.destroy();
  if (admin?.isInitialized) {
    if (/^refactor_test_[a-f0-9]{32}$/.test(name)) await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.destroy();
  }
});

test('question summary counts active questions, HSK levels, skills and game questions in one query', async () => {
  queries.length = 0;
  const result = await questions.getSummary();
  assert.equal(result.totalQuestions, 3); assert.equal(result.gameQuestionsCount, 1);
  assert.deepEqual(result.skillsCount, { LISTENING: 1, READING: 1, WRITING: 1, SPEAKING: 0 });
  assert.equal(result.hskLevelsCount[1], 2); assert.equal(result.hskLevelsCount[2], 1); assert.equal(result.hskLevelsCount[9], 0);
  assert.equal(queries.length, 1);
});
test('teacher metrics retain archived-teacher semantics and six monthly buckets with four queries', async () => {
  queries.length = 0;
  const result = await analytics.getTeacherStats();
  assert.equal(result.overview.totalTeachers, 3); assert.equal(result.overview.activeTeachers, 2);
  assert.equal(result.overview.totalQuestionsContributed, 3); assert.equal(result.overview.totalExamsContributed, 3);
  assert.equal(result.productivityTimeline.categories.length, 6);
  assert.deepEqual(result.productivityTimeline.questionsSeries, [0, 0, 0, 0, 1, 1]);
  assert.deepEqual(result.productivityTimeline.examsSeries, [0, 0, 0, 0, 2, 1]);
  assert.deepEqual(result.skillsAndLevels.skills.counts, [1, 1, 1, 0]);
  assert.equal(result.leaderboard.length, 3);
  assert.equal(queries.length, 4);
});
test('study dashboard keeps duplicate-day pings and history correct while using three queries', async () => {
  queries.length = 0;
  const result = await analytics.getDashboard(studentId);
  assert.equal(result.timeToday, 1.5); assert.equal(result.time7Days, 3); assert.equal(result.timeTotal, 6);
  assert.equal(result.totalDaysStudied, 4); assert.equal(result.averagePerDay, 1.5); assert.equal(result.longestStreak, 2);
  assert.deepEqual(result.chart7Days, [0.5, 0, 0, 0, 0, 1, 1.5]);
  assert.equal(queries.length, 3);
  const empty = await analytics.getDashboard(2147483647);
  assert.deepEqual(empty, { timeToday: 0, time7Days: 0, timeTotal: 0, chart7Days: [0, 0, 0, 0, 0, 0, 0], totalDaysStudied: 0, averagePerDay: 0, longestStreak: 0 });
});
test('exam pagination preserves nested structure and counts without duplicating parent rows', async () => {
  const first = await exams.findAll({ limit: 1, page: 1 });
  assert.equal(first.total, 2); assert.equal(first.data.length, 1); assert.equal(first.totalPages, 2);
  const second = await exams.findAll({ limit: 1, page: 2 });
  assert.equal(second.data[0].id, examId); assert.equal(second.data[0].totalSections, 2); assert.equal(second.data[0].totalQuestions, 2);
  assert.equal(second.data[0].sections.length, 2);
  assert.equal(second.data[0].sections.flatMap(section => section.sectionQuestions).length, 2);
  const filtered = await exams.findAll({ hskLevel: 1, search: 'primary' });
  assert.equal(filtered.total, 1); assert.equal(filtered.data[0].id, examId);
  const missing = await exams.findAll({ search: 'does not exist' });
  assert.deepEqual(missing.data, []); assert.equal(missing.total, 0);
});
