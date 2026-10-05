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
  password: process.env.DATABASE_PASSWORD || 'secret',
  database: process.env.DATABASE_NAME || 'api',
  entities: [
    PracticeSetEntity,
    QuestionEntity,
    PracticeSetQuestionEntity,
    ExamEntity,
    ExamSectionEntity,
    ExamSectionQuestionEntity,
  ],
  synchronize: false,
});

// Real HSK 2 Lessons from Table of Contents
const HSK2_LESSONS = [
  { no: 1, zh: '她请我们吃了北京烤鸭', en: 'She treated us to Peking Duck' },
  { no: 2, zh: '还是打车去北大吧', en: "Let's take a taxi to Peking University instead" },
  { no: 3, zh: '我想去西安旅游', en: 'I want to visit Xi’an' },
  { no: 4, zh: '你穿红色的很好看', en: 'You look pretty good in red' },
  { no: 5, zh: '第一次去中国朋友家', en: "Visiting a Chinese friend's home for the first time" },
  { no: 6, zh: '小雪，生日快乐！', en: 'Happy birthday, Xiaoxue!' },
  { no: 7, zh: '他篮球打得很好', en: 'He plays basketball very well' },
  { no: 8, zh: '虽然你忘了，但是我记得', en: 'Even though you forgot, I remembered' },
  { no: 9, zh: '我去买杯奶茶', en: "I'm going to buy a cup of bubble tea" },
  { no: 10, zh: '就要考试了', en: 'The exam is coming' },
  { no: 11, zh: '我最喜欢吃中国菜', en: 'I like Chinese food the most' },
  { no: 12, zh: '这里比北京冷多了', en: "It's much colder here than in Beijing" },
  { no: 13, zh: '我们爱上中文课', en: 'We love attending Chinese class' },
  { no: 14, zh: '一个人过年多没意思啊', en: "It's boring to celebrate the Spring Festival alone" },
  { no: 15, zh: '我想再去一次中国', en: 'I want to go to China again' },
];

// Real HSK 3 Lessons from Table of Contents
const HSK3_LESSONS = [
  { no: 1, zh: '我们去机场接你们', en: 'We will pick you up at the airport' },
  { no: 2, zh: '你们想吃什么就点什么', en: 'You can order whatever you feel like' },
  { no: 3, zh: '这个小区挺好的', en: 'This neighborhood is pretty nice' },
  { no: 4, zh: '这家宾馆跟别的都不一样', en: 'This hotel is unlike any other' },
  { no: 5, zh: '这样的照片才好看', en: 'Photos like these are the best' },
  { no: 6, zh: '高铁上还可以点外卖', en: 'You can even order takeout on a high-speed train' },
  { no: 7, zh: '那条裙子比短裤更好看', en: 'That skirt looks better than the shorts' },
  { no: 8, zh: '今天我出院了', en: 'Today I was discharged from the hospital' },
  { no: 9, zh: '打不好没关系', en: "It doesn't matter if you don't play well" },
  { no: 10, zh: '你明天再把书还给我', en: 'You can return the book to me tomorrow' },
  { no: 11, zh: '看来我没办法解决这个问题', en: "It seems I can't solve this problem" },
  { no: 12, zh: '这个季节天气变化很快', en: 'The weather changes rapidly in this season' },
  { no: 13, zh: '我的新邻居来自英国', en: 'My new neighbors come from the UK' },
  { no: 14, zh: '这本书被别人借走了', en: 'This book is checked out' },
  { no: 15, zh: '我是半个南京人', en: 'I am basically half a Nanjing local' },
  { no: 16, zh: '我听说有的熊猫出国了', en: 'I heard that some pandas have gone abroad' },
  { no: 17, zh: '我要多向认真的人学习', en: 'I will learn from people who are careful' },
  { no: 18, zh: '我学会了包饺子', en: "I've learned how to make jiaozi" },
];

async function seed() {
  await AppDataSource.initialize();
  console.log('Database connected successfully.');

  const qRepo = AppDataSource.getRepository(QuestionEntity);
  const psRepo = AppDataSource.getRepository(PracticeSetEntity);
  const psqRepo = AppDataSource.getRepository(PracticeSetQuestionEntity);
  const examRepo = AppDataSource.getRepository(ExamEntity);
  const sectionRepo = AppDataSource.getRepository(ExamSectionEntity);
  const esqRepo = AppDataSource.getRepository(ExamSectionQuestionEntity);

  // ==========================================
  // 1. SEED HSK 2 PRACTICE SETS (15 Lessons)
  // ==========================================
  console.log('--- Seeding HSK 2 Practice Sets ---');
  for (const lesson of HSK2_LESSONS) {
    const ps = new PracticeSetEntity();
    ps.title = `HSK 2 Bài ${lesson.no}: ${lesson.zh}`;
    ps.topic = lesson.en;
    ps.skill = QuestionSkillEnum.READING;
    ps.hskLevel = 2;
    const savedPS = await psRepo.save(ps);

    // 6 practice questions per lesson: 2 Listening, 2 Reading, 2 Writing
    const skills = [
      QuestionSkillEnum.LISTENING,
      QuestionSkillEnum.LISTENING,
      QuestionSkillEnum.READING,
      QuestionSkillEnum.READING,
      QuestionSkillEnum.WRITING,
      QuestionSkillEnum.WRITING,
    ];

    for (let j = 1; j <= 6; j++) {
      const skill = skills[j - 1];
      const q = new QuestionEntity();
      q.skill = skill;
      q.difficulty = 2;
      q.hskLevel = 2;

      if (skill === QuestionSkillEnum.WRITING) {
        q.type = QuestionTypeEnum.FILL_IN_BLANK;
        q.payload = {
          instruction: '根据拼音写汉字 (Điền chữ Hán theo phiên âm pinyin)',
          text: `HSK 2 Bài ${lesson.no} (${lesson.zh}) - Câu hỏi viết ${j}: Điền chữ Hán thích hợp vào chỗ trống`,
          pinyin: 'wǒmen qù zhōngguó fànguǎn chīfàn',
          sentence: '我们 去 中国 (     ) 吃饭。',
        };
        q.correctAnswer = { answer: '饭馆' };
      } else if (skill === QuestionSkillEnum.LISTENING) {
        q.type = QuestionTypeEnum.MULTIPLE_CHOICE;
        q.payload = {
          instruction: '听对话，选择正确答案 (Nghe hội thoại và chọn đáp án đúng)',
          text: `HSK 2 Bài ${lesson.no} (${lesson.zh}) - Câu hỏi nghe ${j}`,
          audioUrl: `hsk2_lesson_${String(lesson.no).padStart(2, '0')}_audio_${j}.mp3`,
          options: ['饭店 (fàndiàn)', '超市 (chāoshì)', '学校 (xuéxiào)', '机场 (jīchǎng)'],
        };
        q.correctAnswer = { answer: 'A' };
      } else {
        q.type = QuestionTypeEnum.MULTIPLE_CHOICE;
        q.payload = {
          instruction: '读句子，选择正确词语填空 (Đọc câu và chọn từ thích hợp)',
          text: `HSK 2 Bài ${lesson.no} (${lesson.zh}) - Câu hỏi đọc hiểu ${j}`,
          sentence: `请问，这本书是你的吗？—— (    )，这是我朋友的书。`,
          options: ['不是 (bú shì)', '很好 (hěn hǎo)', '可以 (kěyǐ)', '没有 (méiyǒu)'],
        };
        q.correctAnswer = { answer: 'A' };
      }

      const savedQ = await qRepo.save(q);

      const psq = new PracticeSetQuestionEntity();
      psq.practiceSetId = savedPS.id;
      psq.questionId = savedQ.id;
      psq.order = j;
      await psqRepo.save(psq);
    }
  }
  console.log(`Seeded 15 HSK 2 Lessons with 90 practice questions.`);

  // ==========================================
  // 2. SEED HSK 3 PRACTICE SETS (18 Lessons)
  // ==========================================
  console.log('--- Seeding HSK 3 Practice Sets ---');
  for (const lesson of HSK3_LESSONS) {
    const ps = new PracticeSetEntity();
    ps.title = `HSK 3 Bài ${lesson.no}: ${lesson.zh}`;
    ps.topic = lesson.en;
    ps.skill = QuestionSkillEnum.READING;
    ps.hskLevel = 3;
    const savedPS = await psRepo.save(ps);

    // 6 practice questions per lesson: 2 Listening, 2 Reading, 2 Writing
    const skills = [
      QuestionSkillEnum.LISTENING,
      QuestionSkillEnum.LISTENING,
      QuestionSkillEnum.READING,
      QuestionSkillEnum.READING,
      QuestionSkillEnum.WRITING,
      QuestionSkillEnum.WRITING,
    ];

    for (let j = 1; j <= 6; j++) {
      const skill = skills[j - 1];
      const q = new QuestionEntity();
      q.skill = skill;
      q.difficulty = 3;
      q.hskLevel = 3;

      if (skill === QuestionSkillEnum.WRITING) {
        q.type = QuestionTypeEnum.FILL_IN_BLANK;
        q.payload = {
          instruction: '连词成句 / 看图写汉字 (Sắp xếp từ thành câu / Nhìn tranh viết câu)',
          text: `HSK 3 Bài ${lesson.no} (${lesson.zh}) - Bài tập viết ${j}`,
          words: ['这本', '借走了', '被', '书', '别人'],
        };
        q.correctAnswer = { answer: '这本书被别人借走了。' };
      } else if (skill === QuestionSkillEnum.LISTENING) {
        q.type = QuestionTypeEnum.MULTIPLE_CHOICE;
        q.payload = {
          instruction: '听短文/对话，选择正确答案 (Nghe đoạn văn/hội thoại, chọn đáp án đúng)',
          text: `HSK 3 Bài ${lesson.no} (${lesson.zh}) - Câu hỏi nghe ${j}`,
          audioUrl: `hsk3_lesson_${String(lesson.no).padStart(2, '0')}_audio_${j}.mp3`,
          options: ['飞机已经降落了', '他们去火车站', '宾馆很便宜', '天气很晴朗'],
        };
        q.correctAnswer = { answer: 'A' };
      } else {
        q.type = QuestionTypeEnum.MULTIPLE_CHOICE;
        q.payload = {
          instruction: '阅读短文，选择正确答案 (Đọc đoạn văn và chọn đáp án)',
          text: `HSK 3 Bài ${lesson.no} (${lesson.zh}) - Câu hỏi đọc hiểu ${j}`,
          passage: `我们今天坐高铁去上海，车上不仅速度快，而且还可以点外卖，非常方便。`,
          question: `根据短文，坐高铁感觉怎么样？`,
          options: ['很方便', '很麻烦', '很慢', '很贵'],
        };
        q.correctAnswer = { answer: 'A' };
      }

      const savedQ = await qRepo.save(q);

      const psq = new PracticeSetQuestionEntity();
      psq.practiceSetId = savedPS.id;
      psq.questionId = savedQ.id;
      psq.order = j;
      await psqRepo.save(psq);
    }
  }
  console.log(`Seeded 18 HSK 3 Lessons with 108 practice questions.`);

  // ==========================================
  // 3. SEED HSK 2 MOCK EXAM (60 Questions)
  // Structure: Listening 25, Reading 25, Writing 10
  // ==========================================
  console.log('--- Seeding HSK 2 Mock Exam ---');
  const exam2 = new ExamEntity();
  exam2.title = 'HSK 2 模拟测试 (Đề thi mẫu HSK 2 - Chuẩn HSK 3.0)';
  exam2.description = 'Đề thi mẫu hoàn chỉnh từ sách bài tập HSK 2 (Khung đề HSK 3.0: 60 câu - 60 phút)';
  exam2.hskLevel = 2;
  const savedExam2 = await examRepo.save(exam2);

  // Section 1: Listening (25 questions)
  const sec2_L = new ExamSectionEntity();
  sec2_L.examId = savedExam2.id;
  sec2_L.title = '第一部分 听力 (Listening - 25 câu, ~17 phút)';
  sec2_L.order = 1;
  const savedSec2_L = await sectionRepo.save(sec2_L);

  for (let i = 1; i <= 25; i++) {
    const q = new QuestionEntity();
    q.skill = QuestionSkillEnum.LISTENING;
    q.type = QuestionTypeEnum.MULTIPLE_CHOICE;
    q.difficulty = 2;
    q.hskLevel = 2;
    q.payload = {
      instruction: `听力第 ${i} 题：听录音并选择正确答案`,
      audioUrl: `hsk2_mock_listening_${String(i).padStart(2, '0')}.mp3`,
      options: ['A. 去买东西', 'B. 去学校', 'C. 去医院', 'D. 在家休息'],
    };
    q.correctAnswer = { answer: 'A' };
    const savedQ = await qRepo.save(q);

    const esq = new ExamSectionQuestionEntity();
    esq.sectionId = savedSec2_L.id;
    esq.questionId = savedQ.id;
    esq.order = i;
    await esqRepo.save(esq);
  }

  // Section 2: Reading (25 questions)
  const sec2_R = new ExamSectionEntity();
  sec2_R.examId = savedExam2.id;
  sec2_R.title = '第二部分 阅读 (Reading - 25 câu, 25 phút)';
  sec2_R.order = 2;
  const savedSec2_R = await sectionRepo.save(sec2_R);

  for (let i = 1; i <= 25; i++) {
    const q = new QuestionEntity();
    q.skill = QuestionSkillEnum.READING;
    q.type = QuestionTypeEnum.MULTIPLE_CHOICE;
    q.difficulty = 2;
    q.hskLevel = 2;
    q.payload = {
      instruction: `阅读第 ${i + 25} 题：选词填空 / 阅读匹配`,
      text: `HSK 2 模拟题 阅读第 ${i} 题：请选择正确选项填入括号`,
      sentence: `医生说他的身体已经 (    ) 了，明天可以出院。`,
      options: ['好', '多', '高', '冷'],
    };
    q.correctAnswer = { answer: 'A' };
    const savedQ = await qRepo.save(q);

    const esq = new ExamSectionQuestionEntity();
    esq.sectionId = savedSec2_R.id;
    esq.questionId = savedQ.id;
    esq.order = i;
    await esqRepo.save(esq);
  }

  // Section 3: Writing (10 questions)
  const sec2_W = new ExamSectionEntity();
  sec2_W.examId = savedExam2.id;
  sec2_W.title = '第三部分 书写 (Writing - 10 câu, 10 phút)';
  sec2_W.order = 3;
  const savedSec2_W = await sectionRepo.save(sec2_W);

  for (let i = 1; i <= 10; i++) {
    const q = new QuestionEntity();
    q.skill = QuestionSkillEnum.WRITING;
    q.type = QuestionTypeEnum.FILL_IN_BLANK;
    q.difficulty = 2;
    q.hskLevel = 2;
    q.payload = {
      instruction: i <= 5 ? `根据部件组字 (Ghép bộ thủ thành chữ Hán)` : `根据拼音写汉字 (Điền chữ Hán theo phiên âm)`,
      text: `HSK 2 模拟题 书写第 ${i + 50} 题`,
      pinyin: i <= 5 ? 'míng (名字)' : 'chī (吃饭)',
      hint: i <= 5 ? '夕 + 口 -> 名' : '口 + 乞 -> 吃',
    };
    q.correctAnswer = { answer: i <= 5 ? '名' : '吃' };
    const savedQ = await qRepo.save(q);

    const esq = new ExamSectionQuestionEntity();
    esq.sectionId = savedSec2_W.id;
    esq.questionId = savedQ.id;
    esq.order = i;
    await esqRepo.save(esq);
  }
  console.log(`Seeded HSK 2 Mock Exam (60 questions: 25L + 25R + 10W).`);

  // ==========================================
  // 4. SEED HSK 3 MOCK EXAM (70 Questions)
  // Structure: Listening 30, Reading 30, Writing 10
  // ==========================================
  console.log('--- Seeding HSK 3 Mock Exam ---');
  const exam3 = new ExamEntity();
  exam3.title = 'HSK 3 模拟测试 (Đề thi mẫu HSK 3 - Chuẩn HSK 3.0)';
  exam3.description = 'Đề thi mẫu hoàn chỉnh từ sách bài tập HSK 3 (Khung đề HSK 3.0: 70 câu - 83 phút)';
  exam3.hskLevel = 3;
  const savedExam3 = await examRepo.save(exam3);

  // Section 1: Listening (30 questions)
  const sec3_L = new ExamSectionEntity();
  sec3_L.examId = savedExam3.id;
  sec3_L.title = '第一部分 听力 (Listening - 30 câu, ~23 phút)';
  sec3_L.order = 1;
  const savedSec3_L = await sectionRepo.save(sec3_L);

  for (let i = 1; i <= 30; i++) {
    const q = new QuestionEntity();
    q.skill = QuestionSkillEnum.LISTENING;
    q.type = QuestionTypeEnum.MULTIPLE_CHOICE;
    q.difficulty = 3;
    q.hskLevel = 3;
    q.payload = {
      instruction: `听力第 ${i} 题：听短文/对话，选择最恰当的答案`,
      audioUrl: `hsk3_mock_listening_${String(i).padStart(2, '0')}.mp3`,
      options: ['A. 去机场接朋友', 'B. 在宾馆休息', 'C. 坐高铁回北京', 'D. 去医院看病'],
    };
    q.correctAnswer = { answer: 'A' };
    const savedQ = await qRepo.save(q);

    const esq = new ExamSectionQuestionEntity();
    esq.sectionId = savedSec3_L.id;
    esq.questionId = savedQ.id;
    esq.order = i;
    await esqRepo.save(esq);
  }

  // Section 2: Reading (30 questions)
  const sec3_R = new ExamSectionEntity();
  sec3_R.examId = savedExam3.id;
  sec3_R.title = '第二部分 阅读 (Reading - 30 câu, 30 phút)';
  sec3_R.order = 2;
  const savedSec3_R = await sectionRepo.save(sec3_R);

  for (let i = 1; i <= 30; i++) {
    const q = new QuestionEntity();
    q.skill = QuestionSkillEnum.READING;
    q.type = QuestionTypeEnum.MULTIPLE_CHOICE;
    q.difficulty = 3;
    q.hskLevel = 3;
    q.payload = {
      instruction: `阅读第 ${i + 30} 题：阅读句子或短文，选择正确答案`,
      text: `HSK 3 模拟题 阅读第 ${i} 题`,
      passage: `看来我没有办法在短时间内解决这个问题，需要找张老师一起商量一下。`,
      question: `说话人打算怎么做？`,
      options: ['跟张老师商量', '自己独立完成', '放弃这个问题', '马上交给校长'],
    };
    q.correctAnswer = { answer: 'A' };
    const savedQ = await qRepo.save(q);

    const esq = new ExamSectionQuestionEntity();
    esq.sectionId = savedSec3_R.id;
    esq.questionId = savedQ.id;
    esq.order = i;
    await esqRepo.save(esq);
  }

  // Section 3: Writing (10 questions)
  const sec3_W = new ExamSectionEntity();
  sec3_W.examId = savedExam3.id;
  sec3_W.title = '第三部分 书写 (Writing - 10 câu, 20 phút)';
  sec3_W.order = 3;
  const savedSec3_W = await sectionRepo.save(sec3_W);

  for (let i = 1; i <= 10; i++) {
    const q = new QuestionEntity();
    q.skill = QuestionSkillEnum.WRITING;
    q.type = QuestionTypeEnum.FILL_IN_BLANK;
    q.difficulty = 3;
    q.hskLevel = 3;
    q.payload = {
      instruction: i <= 5 ? `连词成句 (Sắp xếp các từ thành câu hoàn chỉnh)` : `看图写一句话 (Nhìn tranh và từ gợi ý viết thành câu)`,
      text: `HSK 3 模拟题 书写第 ${i + 60} 题`,
      words: i <= 5 ? ['这本', '被', '借走了', '书', '同学'] : ['开心', '他跳起来了'],
      keyword: i > 5 ? '开心' : null,
    };
    q.correctAnswer = { answer: i <= 5 ? '这本书被同学借走了。' : '他开心得跳起来了。' };
    const savedQ = await qRepo.save(q);

    const esq = new ExamSectionQuestionEntity();
    esq.sectionId = savedSec3_W.id;
    esq.questionId = savedQ.id;
    esq.order = i;
    await esqRepo.save(esq);
  }
  console.log(`Seeded HSK 3 Mock Exam (70 questions: 30L + 30R + 10W).`);

  await AppDataSource.destroy();
  console.log('Seeding completed successfully!');
}

seed().catch((err) => {
  console.error('Error during seeding:', err);
  process.exit(1);
});
