import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { PracticeSetEntity } from './src/practice-sets/infrastructure/persistence/relational/entities/practice-set.entity';
import { QuestionEntity } from './src/questions/infrastructure/persistence/relational/entities/question.entity';
import { PracticeSetQuestionEntity } from './src/practice-sets/infrastructure/persistence/relational/entities/practice-set-question.entity';
import { ExamEntity } from './src/exams/infrastructure/persistence/relational/entities/exam.entity';
import { ExamSectionEntity } from './src/exams/infrastructure/persistence/relational/entities/exam-section.entity';
import { ExamSectionQuestionEntity } from './src/exams/infrastructure/persistence/relational/entities/exam-section-question.entity';
import { QuestionTypeEnum, QuestionSkillEnum } from './src/questions/infrastructure/persistence/relational/entities/question.enum';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'hsk_db',
  entities: [
    PracticeSetEntity,
    QuestionEntity,
    PracticeSetQuestionEntity,
    ExamEntity,
    ExamSectionEntity,
    ExamSectionQuestionEntity
  ],
  synchronize: false,
});

async function seedData() {
  await AppDataSource.initialize();
  console.log('Database connected.');

  const questionRepo = AppDataSource.getRepository(QuestionEntity);
  const practiceSetRepo = AppDataSource.getRepository(PracticeSetEntity);
  const practiceSetQuestionRepo = AppDataSource.getRepository(PracticeSetQuestionEntity);
  const examRepo = AppDataSource.getRepository(ExamEntity);
  const examSectionRepo = AppDataSource.getRepository(ExamSectionEntity);
  const examSectionQuestionRepo = AppDataSource.getRepository(ExamSectionQuestionEntity);

  // Seed 15 Lessons
  for (let i = 1; i <= 15; i++) {
    const practiceSet = new PracticeSetEntity();
    practiceSet.title = "HSK 1 Workbook - Lesson " + i;
    practiceSet.topic = "Topic " + i;
    practiceSet.skill = QuestionSkillEnum.READING;
    practiceSet.hskLevel = 1;
    const savedPracticeSet = await practiceSetRepo.save(practiceSet);

    // Create 5 questions for each lesson
    for (let j = 1; j <= 5; j++) {
      const q = new QuestionEntity();
      q.type = QuestionTypeEnum.MULTIPLE_CHOICE;
      q.skill = j % 2 === 0 ? QuestionSkillEnum.LISTENING : QuestionSkillEnum.READING;
      q.difficulty = 1;
      q.hskLevel = 1;
      q.payload = {
        text: "Sample Question " + j + " for Lesson " + i,
        options: ['A', 'B', 'C', 'D'],
        audioUrl: q.skill === QuestionSkillEnum.LISTENING ? 'sample-audio.mp3' : null
      };
      q.correctAnswer = { answer: 'A' };
      const savedQ = await questionRepo.save(q);

      const psq = new PracticeSetQuestionEntity();
      psq.practiceSetId = savedPracticeSet.id;
      psq.questionId = savedQ.id;
      psq.order = j;
      await practiceSetQuestionRepo.save(psq);
    }
    console.log("Seeded Lesson " + i);
  }

  // Seed Mock Exam
  const exam = new ExamEntity();
  exam.title = 'HSK 1 Mock Test (Workbook)';
  exam.description = 'Final mock test from HSK 1 workbook';
  exam.hskLevel = 1;
  const savedExam = await examRepo.save(exam);

  // Listening Section
  const listeningSection = new ExamSectionEntity();
  listeningSection.examId = savedExam.id;
  listeningSection.title = 'Listening';
  listeningSection.order = 1;
  const savedListening = await examSectionRepo.save(listeningSection);

  for (let j = 1; j <= 20; j++) {
    const q = new QuestionEntity();
    q.type = QuestionTypeEnum.MULTIPLE_CHOICE;
    q.skill = QuestionSkillEnum.LISTENING;
    q.difficulty = 1;
    q.hskLevel = 1;
    q.payload = {
      text: "Listening Question " + j,
      options: ['A', 'B', 'C'],
      audioUrl: 'sample-audio.mp3'
    };
    q.correctAnswer = { answer: 'A' };
    const savedQ = await questionRepo.save(q);

    const esq = new ExamSectionQuestionEntity();
    esq.sectionId = savedListening.id;
    esq.questionId = savedQ.id;
    esq.order = j;
    await examSectionQuestionRepo.save(esq);
  }

  console.log('Seeded Mock Exam.');
  await AppDataSource.destroy();
}

seedData().catch((err) => {
  console.error('Error seeding data:', err);
});
