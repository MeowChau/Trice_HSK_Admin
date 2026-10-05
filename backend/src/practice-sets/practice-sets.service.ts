import { Injectable, NotFoundException, Optional, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeSetEntity } from './infrastructure/persistence/relational/entities/practice-set.entity';
import { PracticeSetQuestionEntity } from './infrastructure/persistence/relational/entities/practice-set-question.entity';
import { QuestionSkillEnum } from '../questions/infrastructure/persistence/relational/entities/question.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { VocabularyEntity } from '../offline-games/infrastructure/persistence/relational/entities/vocabulary.entity';

// Standard HSK Topics catalog based on official textbooks & workbooks
export const STANDARD_TOPICS = [
  // HSK 1 (15 lessons from official New HSK 1 Workbook)
  { topic: 'HSK1-L01', titleCn: 'AI 小语，你好！', pinyin: 'AI Xiǎoyǔ, nǐ hǎo!', titleVi: 'Bài 1: Chào bạn, AI Tiểu Ngữ!', hskLevel: 1, icon: '👋' },
  { topic: 'HSK1-L02', titleCn: '我叫李文', pinyin: 'Wǒ jiào Lǐ Wén', titleVi: 'Bài 2: Tôi tên là Lý Văn', hskLevel: 1, icon: '🏷️' },
  { topic: 'HSK1-L03', titleCn: '我是中国人', pinyin: 'Wǒ shì Zhōngguórén', titleVi: 'Bài 3: Tôi là người Trung Quốc', hskLevel: 1, icon: '🇨🇳' },
  { topic: 'HSK1-L04', titleCn: '我有两个孩子', pinyin: 'Wǒ yǒu liǎng gè háizi', titleVi: 'Bài 4: Tôi có hai đứa con', hskLevel: 1, icon: '👨‍👩‍👧‍👦' },
  { topic: 'HSK1-L05', titleCn: '今天我休息', pinyin: 'Jīntiān wǒ xiūxi', titleVi: 'Bài 5: Hôm nay tôi được nghỉ', hskLevel: 1, icon: '🛋️' },
  { topic: 'HSK1-L06', titleCn: '你的手机号是多少？', pinyin: 'Nǐ de shǒujī hào shì duōshao?', titleVi: 'Bài 6: Số điện thoại của bạn là bao nhiêu?', hskLevel: 1, icon: '📱' },
  { topic: 'HSK1-L07', titleCn: '我晚上六点半下班', pinyin: 'Wǒ wǎnshang liù diǎn bàn xiàbān', titleVi: 'Bài 7: Tôi tan làm lúc 6 rưỡi tối', hskLevel: 1, icon: '⏰' },
  { topic: 'HSK1-L08', titleCn: '我爸爸也在医院工作', pinyin: 'Wǒ bàba yě zài yīyuàn gōngzuò', titleVi: 'Bài 8: Bố tôi cũng làm việc ở bệnh viện', hskLevel: 1, icon: '🏥' },
  { topic: 'HSK1-L09', titleCn: '我明天上午在学校学习', pinyin: 'Wǒ míngtiān shàngwǔ zài xuéxiào xuéxí', titleVi: 'Bài 9: Sáng mai tôi học ở trường', hskLevel: 1, icon: '🏫' },
  { topic: 'HSK1-L10', titleCn: '这儿的苹果真便宜！', pinyin: 'Zhèr de píngguǒ zhēn piányi!', titleVi: 'Bài 10: Táo ở đây thật là rẻ!', hskLevel: 1, icon: '🍎' },
  { topic: 'HSK1-L11', titleCn: '我读大学呢', pinyin: 'Wǒ dú dàxué ne', titleVi: 'Bài 11: Tôi đang học đại học', hskLevel: 1, icon: '🎓' },
  { topic: 'HSK1-L12', titleCn: '昨天下雪了', pinyin: 'Zuótiān xiàxuě le', titleVi: 'Bài 12: Hôm qua có tuyết rơi', hskLevel: 1, icon: '❄️' },
  { topic: 'HSK1-L13', titleCn: '请给我一杯茶', pinyin: 'Qǐng gěi wǒ yì bēi chá', titleVi: 'Bài 13: Xin cho tôi một ly trà', hskLevel: 1, icon: '🍵' },
  { topic: 'HSK1-L14', titleCn: '我看了一个电影', pinyin: 'Wǒ kànle yí gè diànyǐng', titleVi: 'Bài 14: Tôi đã xem một bộ phim', hskLevel: 1, icon: '🎬' },
  { topic: 'HSK1-L15', titleCn: '大兴机场见！', pinyin: 'Dàxīng Jīchǎng jiàn!', titleVi: 'Bài 15: Hẹn gặp ở sân bay Đại Hưng!', hskLevel: 1, icon: '🛫' },

  // HSK 2 (15 lessons)
  { topic: 'HSK2-L01', titleCn: '她请我们吃了北京烤鸭', pinyin: 'Tā qǐng wǒmen chīle Běijīng kǎoyā', titleVi: 'Bài 1: Cô ấy mời chúng tôi ăn vịt quay Bắc Kinh', hskLevel: 2, icon: '🦆' },
  { topic: 'HSK2-L02', titleCn: '还是打车去北大吧', pinyin: 'Háishì dǎchē qù Běidà ba', titleVi: 'Bài 2: Hay là đi taxi đến Đại học Bắc Kinh', hskLevel: 2, icon: '🚕' },
  { topic: 'HSK2-L03', titleCn: '我想去西安旅游', pinyin: 'Wǒ xiǎng qù Xī’ān lǚyóu', titleVi: 'Bài 3: Tôi muốn đi du lịch Tây An', hskLevel: 2, icon: '🚅' },
  { topic: 'HSK2-L04', titleCn: '你穿红色的很好看', pinyin: 'Nǐ chuān hóngsè de hěn hǎokàn', titleVi: 'Bài 4: Bạn mặc đồ màu đỏ rất đẹp', hskLevel: 2, icon: '👗' },
  { topic: 'HSK2-L05', titleCn: '第一次去中国朋友家', pinyin: 'Dì-yī cì qù Zhōngguó péngyǒu jiā', titleVi: 'Bài 5: Lần đầu tiên đến nhà bạn Trung Quốc', hskLevel: 2, icon: '🏡' },
  { topic: 'HSK2-L06', titleCn: '小雪，生日快乐！', pinyin: 'Xiǎoxuě, shēngrì kuàilè!', titleVi: 'Bài 6: Tiểu Tuyết, sinh nhật vui vẻ!', hskLevel: 2, icon: '🎉' },
  { topic: 'HSK2-L07', titleCn: '他篮球打得很好', pinyin: 'Tā lánqiú dǎ de hěn hǎo', titleVi: 'Bài 7: Cậu ấy chơi bóng rổ rất cừ', hskLevel: 2, icon: '🏀' },
  { topic: 'HSK2-L08', titleCn: '虽然你忘了，但是我记得', pinyin: 'Suīrán nǐ wàng le, dànshì wǒ jìde', titleVi: 'Bài 8: Mặc dù bạn quên nhưng tôi vẫn nhớ', hskLevel: 2, icon: '📖' },
  { topic: 'HSK2-L09', titleCn: '我去买杯奶茶', pinyin: 'Wǒ qù mǎi bēi nǎichá', titleVi: 'Bài 9: Tôi đi mua một cốc trà sữa', hskLevel: 2, icon: '🧋' },
  { topic: 'HSK2-L10', titleCn: '就要考试了', pinyin: 'Jiù yào kǎoshì le', titleVi: 'Bài 10: Sắp phải thi rồi', hskLevel: 2, icon: '📝' },
  { topic: 'HSK2-L11', titleCn: '我最喜欢吃中国菜', pinyin: 'Wǒ zuì xǐhuan chī Zhōngguócài', titleVi: 'Bài 11: Tôi thích ăn món Trung Quốc nhất', hskLevel: 2, icon: '🥟' },
  { topic: 'HSK2-L12', titleCn: '这里比北京冷多了', pinyin: 'Zhèlǐ bǐ Běijīng lěng duō le', titleVi: 'Bài 12: Nơi này lạnh hơn Bắc Kinh nhiều', hskLevel: 2, icon: '❄️' },
  { topic: 'HSK2-L13', titleCn: '我们爱上中文课', pinyin: 'Wǒmen ài shàng Zhōngwén kè', titleVi: 'Bài 13: Chúng tôi rất thích tiết học tiếng Trung', hskLevel: 2, icon: '📚' },
  { topic: 'HSK2-L14', titleCn: '一个人过年多没意思啊', pinyin: 'Yí gè rén guònián duō méi yìsi a', titleVi: 'Bài 14: Đón Tết một mình thật chán', hskLevel: 2, icon: '🏮' },
  { topic: 'HSK2-L15', titleCn: '我想再去一次中国', pinyin: 'Wǒ xiǎng zài qù yí cì Zhōngguó', titleVi: 'Bài 15: Tôi muốn đến Trung Quốc một lần nữa', hskLevel: 2, icon: '🌏' },

  // HSK 3 (18 lessons)
  { topic: 'HSK3-L01', titleCn: '我们去机场接你们', pinyin: 'Wǒmen qù jīchǎng jiē nǐmen', titleVi: 'Bài 1: Chúng tôi ra sân bay đón các bạn', hskLevel: 3, icon: '🛫' },
  { topic: 'HSK3-L02', titleCn: '你们想吃什么就点什么', pinyin: 'Nǐmen xiǎng chī shénme jiù diǎn shénme', titleVi: 'Bài 2: Các bạn muốn ăn gì thì cứ gọi', hskLevel: 3, icon: '🍲' },
  { topic: 'HSK3-L03', titleCn: '这个小区挺好的', pinyin: 'Zhège xiǎoqū tǐng hǎo de', titleVi: 'Bài 3: Khu dân cư này khá tốt', hskLevel: 3, icon: '🏢' },
  { topic: 'HSK3-L04', titleCn: '这家宾馆跟别的都不一样', pinyin: 'Zhè jiā bīnguǎn gēn bié de dōu bù yíyàng', titleVi: 'Bài 4: Khách sạn này khác hẳn mọi nơi khác', hskLevel: 3, icon: '🏨' },
  { topic: 'HSK3-L05', titleCn: '这样的照片才好看', pinyin: 'Zhèyàng de zhàopiàn cái hǎokàn', titleVi: 'Bài 5: Ảnh chụp như thế này mới đẹp', hskLevel: 3, icon: '📸' },
  { topic: 'HSK3-L06', titleCn: '高铁上还可以点外卖', pinyin: 'Gāotiě shang hái kěyǐ diǎn wàimài', titleVi: 'Bài 6: Trên tàu cao tốc còn gọi được đồ ăn ngoài', hskLevel: 3, icon: '🚄' },
  { topic: 'HSK3-L07', titleCn: '那条裙子比短裤更好看', pinyin: 'Nà tiáo qúnzi bǐ duǎnkù gèng hǎokàn', titleVi: 'Bài 7: Chiếc váy đó đẹp hơn chiếc quần đùi', hskLevel: 3, icon: '👗' },
  { topic: 'HSK3-L08', titleCn: '今天我出院了', pinyin: 'Jīntiān wǒ chūyuàn le', titleVi: 'Bài 8: Hôm nay tôi đã xuất viện rồi', hskLevel: 3, icon: '🏥' },
  { topic: 'HSK3-L09', titleCn: '打不好没关系', pinyin: 'Dǎ bù hǎo méi guānxi', titleVi: 'Bài 9: Chơi chưa tốt cũng không sao cả', hskLevel: 3, icon: '🏸' },
  { topic: 'HSK3-L10', titleCn: '你明天再把书还给我', pinyin: 'Nǐ míngtiān zài bǎ shū huán gěi wǒ', titleVi: 'Bài 10: Ngày mai bạn hẵng trả sách cho tôi', hskLevel: 3, icon: '📖' },
  { topic: 'HSK3-L11', titleCn: '看来我没办法解决这个问题', pinyin: 'Kànlái wǒ méi bànfǎ jiějué zhège wèntí', titleVi: 'Bài 11: Xem ra tôi không có cách giải quyết vấn đề này', hskLevel: 3, icon: '🧩' },
  { topic: 'HSK3-L12', titleCn: '这个季节天气变化很快', pinyin: 'Zhège jìjié tiānqì biànhuà hěn kuài', titleVi: 'Bài 12: Mùa này thời tiết thay đổi rất nhanh', hskLevel: 3, icon: '🍂' },
  { topic: 'HSK3-L13', titleCn: '我的新邻居来自英国', pinyin: 'Wǒ de xīn línjū láizì Yīngguó', titleVi: 'Bài 13: Người hàng xóm mới của tôi đến từ nước Anh', hskLevel: 3, icon: '🤝' },
  { topic: 'HSK3-L14', titleCn: '这本书被别人借走了', pinyin: 'Zhè běn shū bèi biérén jièzǒu le', titleVi: 'Bài 14: Cuốn sách này đã bị người khác mượn mất', hskLevel: 3, icon: '📚' },
  { topic: 'HSK3-L15', titleCn: '我是半个南京人', pinyin: 'Wǒ shì bàn gè Nánjīngrén', titleVi: 'Bài 15: Tôi là nửa người Nam Kinh', hskLevel: 3, icon: '🏙️' },
  { topic: 'HSK3-L16', titleCn: '我听说有的熊猫出国了', pinyin: 'Wǒ tīngshuō yǒude xióngmāo chūguó le', titleVi: 'Bài 16: Tôi nghe nói có những chú gấu trúc đã đi định cư nước ngoài', hskLevel: 3, icon: '🐼' },
  { topic: 'HSK3-L17', titleCn: '我要多向认真的人学习', pinyin: 'Wǒ yào duō xiàng rènzhēn de rén xuéxí', titleVi: 'Bài 17: Tôi cần học hỏi nhiều từ những người nghiêm túc', hskLevel: 3, icon: '✍️' },
  { topic: 'HSK3-L18', titleCn: '我学会了包饺子', pinyin: 'Wǒ xuéhuì le bāo jiǎozi', titleVi: 'Bài 18: Tôi đã học được cách gói bánh sủi cảo', hskLevel: 3, icon: '🥟' },
];

@Injectable()
export class PracticeSetsService {
  constructor(
    @InjectRepository(PracticeSetEntity)
    private readonly practiceSetRepository: Repository<PracticeSetEntity>,
    @InjectRepository(PracticeSetQuestionEntity)
    private readonly practiceSetQuestionRepository: Repository<PracticeSetQuestionEntity>,
    @InjectRepository(VocabularyEntity)
    private readonly vocabRepository: Repository<VocabularyEntity>,
    @Optional()
    @Inject(AuditLogsService)
    private readonly auditLogsService?: AuditLogsService,
  ) {}

  async create(
    createData: Partial<PracticeSetEntity>,
    user?: any,
  ): Promise<PracticeSetEntity> {
    const practiceSet = this.practiceSetRepository.create(createData);
    const saved = await this.practiceSetRepository.save(practiceSet);

    if (this.auditLogsService) {
      this.auditLogsService
        .createLog({
          userId: user?.id || null,
          userName: user?.fullName || user?.firstName || 'Admin',
          userEmail: user?.email || null,
          action: 'CREATE',
          entityType: 'PRACTICE_SET',
          entityId: String(saved.id),
          summary: `Tạo bài luyện tập "${saved.title}" (${saved.skill} - HSK ${saved.hskLevel})`,
          newData: saved,
        })
        .catch(() => {});
    }

    return saved;
  }

  async update(
    id: number,
    updateData: Partial<PracticeSetEntity>,
    user?: any,
  ): Promise<PracticeSetEntity> {
    const existing = await this.practiceSetRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Practice set with ID ${id} not found`);
    }

    const oldData = { ...existing };
    Object.assign(existing, updateData);
    const saved = await this.practiceSetRepository.save(existing);

    if (this.auditLogsService) {
      this.auditLogsService
        .createLog({
          userId: user?.id || null,
          userName: user?.fullName || user?.firstName || 'Admin',
          userEmail: user?.email || null,
          action: 'UPDATE',
          entityType: 'PRACTICE_SET',
          entityId: String(id),
          summary: `Cập nhật bài luyện tập "${saved.title}"`,
          oldData,
          newData: saved,
        })
        .catch(() => {});
    }

    return saved;
  }

  async remove(id: number, user?: any): Promise<void> {
    const existing = await this.practiceSetRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Practice set with ID ${id} not found`);
    }

    // Delete linked questions
    await this.practiceSetQuestionRepository.delete({ practiceSetId: id });
    await this.practiceSetRepository.delete(id);

    if (this.auditLogsService) {
      this.auditLogsService
        .createLog({
          userId: user?.id || null,
          userName: user?.fullName || user?.firstName || 'Admin',
          userEmail: user?.email || null,
          action: 'DELETE',
          entityType: 'PRACTICE_SET',
          entityId: String(id),
          summary: `Xóa bài luyện tập "${existing.title}" (${existing.skill} - HSK ${existing.hskLevel})`,
          oldData: existing,
        })
        .catch(() => {});
    }
  }

  async setQuestions(
    practiceSetId: number,
    questions: { questionId: number; order: number }[],
  ): Promise<void> {
    const practiceSet = await this.practiceSetRepository.findOne({
      where: { id: practiceSetId },
    });
    if (!practiceSet) {
      throw new NotFoundException(
        `Practice Set with ID ${practiceSetId} not found`,
      );
    }

    // Delete existing questions
    await this.practiceSetQuestionRepository.delete({ practiceSetId });

    // Insert new questions
    if (questions && questions.length > 0) {
      const setQuestions = questions.map((q) =>
        this.practiceSetQuestionRepository.create({
          practiceSetId,
          questionId: q.questionId,
          order: q.order,
        }),
      );
      await this.practiceSetQuestionRepository.save(setQuestions);
    }
  }

  async findWithPagination(params?: {
    page?: number;
    limit?: number;
    skill?: QuestionSkillEnum;
    hskLevel?: number;
    topic?: string;
    search?: string;
  }) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 10));
    const skip = (page - 1) * limit;

    const query = this.practiceSetRepository
      .createQueryBuilder('practiceSet')
      .leftJoinAndSelect('practiceSet.practiceSetQuestions', 'psq')
      .leftJoinAndSelect('psq.question', 'question');

    if (params?.skill) {
      query.andWhere('practiceSet.skill = :skill', { skill: params.skill });
    }

    if (params?.hskLevel && params.hskLevel >= 1 && params.hskLevel <= 9) {
      query.andWhere('practiceSet.hskLevel = :hskLevel', {
        hskLevel: params.hskLevel,
      });
    }

    if (params?.topic && params.topic !== 'ALL') {
      query.andWhere('practiceSet.topic = :topic', { topic: params.topic });
    }

    if (params?.search && params.search.trim()) {
      query.andWhere(
        '(LOWER(practiceSet.title) LIKE :term OR LOWER(practiceSet.topic) LIKE :term)',
        {
          term: `%${params.search.trim().toLowerCase()}%`,
        },
      );
    }

    query.orderBy('practiceSet.id', 'DESC').skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    const formattedData = data.map((set) => {
      const questionsCount = set.practiceSetQuestions?.length || 0;
      return {
        ...set,
        totalQuestions: questionsCount,
      };
    });

    return {
      data: formattedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSummary(skill?: QuestionSkillEnum) {
    const query = this.practiceSetRepository.createQueryBuilder('practiceSet');
    if (skill) {
      query.andWhere('practiceSet.skill = :skill', { skill });
    }

    const sets = await query.getMany();
    const totalSets = sets.length;

    const byHsk: Record<number, number> = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0,
    };
    const byTopic: Record<string, number> = {};

    sets.forEach((s) => {
      if (s.hskLevel) byHsk[s.hskLevel] = (byHsk[s.hskLevel] || 0) + 1;
      if (s.topic) byTopic[s.topic] = (byTopic[s.topic] || 0) + 1;
    });

    // Count total questions across sets
    const totalQuestionsCount = await this.practiceSetQuestionRepository.count();

    return {
      totalSets,
      totalQuestions: totalQuestionsCount,
      byHsk,
      byTopic,
    };
  }

  async getTopicsList(filterHskLevel?: number) {
    // 1. Get stats from DB for practice sets
    const allSets = await this.practiceSetRepository.find({
      relations: ['practiceSetQuestions'],
    });

    const topicStats: Record<
      string,
      {
        totalSets: number;
        totalQuestions: number;
        listeningCount: number;
        speakingCount: number;
        readingCount: number;
        writingCount: number;
        hskLevels: Set<number>;
      }
    > = {};

    allSets.forEach((s) => {
      const key = s.topic || 'Chung';
      if (!topicStats[key]) {
        topicStats[key] = {
          totalSets: 0,
          totalQuestions: 0,
          listeningCount: 0,
          speakingCount: 0,
          readingCount: 0,
          writingCount: 0,
          hskLevels: new Set<number>(),
        };
      }
      topicStats[key].totalSets += 1;
      topicStats[key].totalQuestions += s.practiceSetQuestions?.length || 0;
      if (s.hskLevel) topicStats[key].hskLevels.add(s.hskLevel);

      if (s.skill === QuestionSkillEnum.LISTENING) topicStats[key].listeningCount += 1;
      else if (s.skill === QuestionSkillEnum.SPEAKING) topicStats[key].speakingCount += 1;
      else if (s.skill === QuestionSkillEnum.READING) topicStats[key].readingCount += 1;
      else if (s.skill === QuestionSkillEnum.WRITING) topicStats[key].writingCount += 1;
    });

    // 2. Get vocabulary count per topic from DB
    const vocabCounts = await this.vocabRepository
      .createQueryBuilder('v')
      .select('v.topic', 'topic')
      .addSelect('COUNT(*)', 'cnt')
      .where('v.topic IS NOT NULL')
      .groupBy('v.topic')
      .getRawMany();

    const vocabMap: Record<string, number> = {};
    vocabCounts.forEach((r) => {
      if (r.topic) vocabMap[r.topic] = parseInt(r.cnt, 10);
    });

    // Merge with standard topics catalogue
    let combinedTopics = STANDARD_TOPICS.map((std) => {
      const stats = topicStats[std.topic] || {
        totalSets: 0,
        totalQuestions: 0,
        listeningCount: 0,
        speakingCount: 0,
        readingCount: 0,
        writingCount: 0,
        hskLevels: new Set<number>([std.hskLevel]),
      };

      return {
        id: std.topic,
        topicKey: std.topic,
        titleVi: std.titleVi,
        titleCn: std.titleCn,
        pinyin: std.pinyin,
        icon: std.icon,
        hskLevel: std.hskLevel,
        vocabularyCount: vocabMap[std.topic] || 0,
        totalSets: stats.totalSets,
        totalQuestions: stats.totalQuestions,
        listeningCount: stats.listeningCount,
        speakingCount: stats.speakingCount,
        readingCount: stats.readingCount,
        writingCount: stats.writingCount,
      };
    });

    // Also include any custom topics in DB not in preset
    for (const [key, stats] of Object.entries(topicStats)) {
      if (!STANDARD_TOPICS.some((std) => std.topic === key)) {
        combinedTopics.push({
          id: key,
          topicKey: key,
          titleVi: key,
          titleCn: key,
          pinyin: '',
          icon: '📁',
          hskLevel: Array.from(stats.hskLevels)[0] || 1,
          vocabularyCount: vocabMap[key] || 0,
          totalSets: stats.totalSets,
          totalQuestions: stats.totalQuestions,
          listeningCount: stats.listeningCount,
          speakingCount: stats.speakingCount,
          readingCount: stats.readingCount,
          writingCount: stats.writingCount,
        });
      }
    }

    // Include custom vocabulary topics if any not in preset and not in practice sets
    for (const [key, count] of Object.entries(vocabMap)) {
      if (!combinedTopics.some((t) => t.topicKey === key)) {
        combinedTopics.push({
          id: key,
          topicKey: key,
          titleVi: key,
          titleCn: key,
          pinyin: '',
          icon: '📚',
          hskLevel: 1,
          vocabularyCount: count,
          totalSets: 0,
          totalQuestions: 0,
          listeningCount: 0,
          speakingCount: 0,
          readingCount: 0,
          writingCount: 0,
        });
      }
    }

    if (filterHskLevel) {
      combinedTopics = combinedTopics.filter(
        (t) => t.hskLevel === Number(filterHskLevel),
      );
    }

    return combinedTopics;
  }

  async findAll(filter: {
    skill?: QuestionSkillEnum;
    hskLevel?: number;
    topic?: string;
  }): Promise<PracticeSetEntity[]> {
    const query = this.practiceSetRepository.createQueryBuilder('practiceSet');

    if (filter.skill) {
      query.andWhere('practiceSet.skill = :skill', { skill: filter.skill });
    }
    if (filter.hskLevel) {
      query.andWhere('practiceSet.hskLevel = :hskLevel', {
        hskLevel: filter.hskLevel,
      });
    }
    if (filter.topic) {
      query.andWhere('practiceSet.topic = :topic', { topic: filter.topic });
    }

    return query.getMany();
  }

  async getDetails(id: number): Promise<any> {
    const practiceSet = await this.practiceSetRepository.findOne({
      where: { id },
      relations: ['practiceSetQuestions', 'practiceSetQuestions.question'],
    });

    if (!practiceSet) {
      throw new NotFoundException(`Practice Set with ID ${id} not found`);
    }

    // Sort questions by order
    if (practiceSet.practiceSetQuestions) {
      practiceSet.practiceSetQuestions.sort((a, b) => a.order - b.order);
    }

    return practiceSet;
  }
}
