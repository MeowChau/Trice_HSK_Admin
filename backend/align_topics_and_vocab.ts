import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { PracticeSetEntity } from './src/practice-sets/infrastructure/persistence/relational/entities/practice-set.entity';
import { VocabularyEntity } from './src/offline-games/infrastructure/persistence/relational/entities/vocabulary.entity';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'secret',
  database: process.env.DATABASE_NAME || 'api',
  synchronize: false,
});

// Real HSK 1 Textbook Vocabulary per lesson
const HSK1_VOCAB_MAP: Record<string, string[]> = {
  'HSK1-L01': ['你', '好', '您', '你们', '对不起', '没关系'],
  'HSK1-L02': ['谢谢', '不', '客气', '不客气', '再见'],
  'HSK1-L03': ['叫', '什么', '名字', '我', '是', '老师', '吗', '学生', '人', '中国', '美国'],
  'HSK1-L04': ['她', '谁', '的', '汉语', '哪', '国', '呢', '他', '同学', '朋友'],
  'HSK1-L05': ['家', '有', '口', '女儿', '几', '岁', '了', '今年', '多', '大'],
  'HSK1-L06': ['会', '说', '妈妈', '菜', '很', '好吃', '做', '写', '汉字', '字', '怎么', '读'],
  'HSK1-L07': ['请', '问', '今天', '号', '月', '星期', '昨天', '明天', '去', '学校', '看', '书'],
  'HSK1-L08': ['想', '喝', '茶', '吃', '米饭', '下午', '商店', '买', '个', '杯子', '这', '多少', '钱', '块', '那'],
  'HSK1-L09': ['小', '猫', '在', '那儿', '狗', '椅子', '下', '在', '哪儿', '工作', '儿子', '医院', '医生', '爸爸'],
  'HSK1-L10': ['桌子', '上', '电脑', '和', '本', '里', '前面', '后面', '王方', '谢朋', '这儿', '没有', '能', '坐'],
  'HSK1-L11': ['现在', '点', '分', '中午', '吃饭', '时候', '回', '我们', '电影', '住', '前'],
  'HSK1-L12': ['天气', '怎么样', '太', '热', '冷', '下雨', '雨', '小姐', '来', '身体', '爱', '些', '水果', '水'],
  'HSK1-L13': ['喂', '在', '做', '什么', '学', '学习', '上午', '睡觉', '电视', '喜欢', '给', '打电话', '吧'],
  'HSK1-L14': ['东西', '一点儿', '苹果', '看见', '先生', '开', '车', '回来', '分钟', '后', '张', '漂亮', '衣服', '都', '少', '不少'],
  'HSK1-L15': ['认识', '年', '大学', '饭店', '出租车', '一起', '高兴', '听', '飞机'],
};

// HSK 2 Lessons Vocabulary
const HSK2_VOCAB_MAP: Record<string, string[]> = {
  'HSK2-L01': ['请', '烤鸭', '北京', '好吃', '服务员', '菜单', '点菜', '肉', '鱼'],
  'HSK2-L02': ['打车', '出租车', '去', '大学', '远', '近', '走', '路', '站'],
  'HSK2-L03': ['旅游', '想', '旅游', '西安', '风景', '门票', '照片', '飞机', '火车'],
  'HSK2-L04': ['穿', '红色', '好看', '颜色', '衣服', '件', '合适', '贵', '便宜'],
  'HSK2-L05': ['第一次', '中国', '朋友', '客人', '进', '坐', '客气', '欢迎', '送'],
  'HSK2-L06': ['生日', '快乐', '礼物', '蛋糕', '送', '准备', '晚会', '跳舞', '唱歌'],
  'HSK2-L07': ['篮球', '打', '得', '踢', '足球', '运动', '身体', '跑步', '游泳'],
  'HSK2-L08': ['虽然', '但是', '记得', '忘', '事情', '帮助', '借', '还', '告诉'],
  'HSK2-L09': ['买', '杯', '奶茶', '甜', '好喝', '喝', '冷', '热', '糖'],
  'HSK2-L10': ['就', '要', '考试', '准备', '题', '复习', '容易', '难', '成绩'],
  'HSK2-L11': ['最', '喜欢', '中国菜', '米饭', '面条', '水饺', '味道', '尝', '饱'],
  'HSK2-L12': ['比', '冷', '多', '天气', '下雪', '晴', '阴', '刮风', '温度'],
  'HSK2-L13': ['爱', '中文', '上课', '听力', '发音', '练习', '说话', '老师', '懂'],
  'HSK2-L14': ['一个人', '过年', '没意思', '春节', '热闹', '团聚', '放鞭炮', '想家'],
  'HSK2-L15': ['再', '次', '中国', '希望', '计划', '旅行', '时间', '去过', '机会'],
};

// HSK 3 Lessons Vocabulary
const HSK3_VOCAB_MAP: Record<string, string[]> = {
  'HSK3-L01': ['机场', '接', '航班', '降落', '行李', '箱子', '准时', '辛苦', '护照'],
  'HSK3-L02': ['随便', '点', '特色', '味道', '尝尝', '推荐', '羊肉', '青菜', '饮料'],
  'HSK3-L03': ['小区', '挺好', '环境', '安静', '方便', '超市', '邻居', '绿化', '楼'],
  'HSK3-L04': ['宾馆', '特别', '服务', '前台', '干净', '退房', '入住', '空调', '满意'],
  'HSK3-L05': ['照相机', '拍照', '清楚', '风景', '漂亮', '角度', '水平', '留念'],
  'HSK3-L06': ['高铁', '速度', '点外卖', '方便', '座席', '车厢', '准点', '窗外'],
  'HSK3-L07': ['裙子', '短裤', '比较', '漂亮', '流行', '款式', '试穿', '合身'],
  'HSK3-L08': ['出院', '身体', '恢复', '健康', '医生', '按时', '吃药', '检查'],
  'HSK3-L09': ['比赛', '输', '赢', '水平', '紧张', '发挥', '努力', '没关系'],
  'HSK3-L10': ['明天', '再', '还', '借', '图书馆', '按期', '借阅', '保管'],
  'HSK3-L11': ['看来', '解决', '办法', '商量', '困难', '复杂', '主意', '讨论'],
  'HSK3-L12': ['季节', '变化', '气候', '暖和', '刮风', '干燥', '空气', '注意'],
  'HSK3-L13': ['新', '邻居', '英国', '友好', '交流', '打招呼', '文化', '习惯'],
  'HSK3-L14': ['被', '借走', '书', '同学', '找', '原谅', '发现', '借给'],
  'HSK3-L15': ['半个', '南京人', '熟悉', '方言', '生活', '习惯', '城市', '喜欢'],
  'HSK3-L16': ['听说', '熊猫', '出国', '动物园', '可爱', '保护', '欢迎', '珍贵'],
  'HSK3-L17': ['认真', '学习', '态度', '向', '请教', '进步', '严格', '仔细'],
  'HSK3-L18': ['学会', '包', '饺子', '馅儿', '皮儿', '煮', '传统', '美味'],
};

async function main() {
  await AppDataSource.initialize();
  console.log('DB connected.');

  // 1. Align HSK 1 Practice Sets topic to 'HSK1-L{xx}'
  const hsk1Sets = await AppDataSource.query(`SELECT id, title FROM practice_set WHERE "hskLevel" = 1`);
  for (let i = 0; i < hsk1Sets.length; i++) {
    const s = hsk1Sets[i];
    const match = s.title.match(/Lesson (\d+)/i) || s.title.match(/Bài (\d+)/i);
    const num = match ? parseInt(match[1], 10) : i + 1;
    const topicKey = `HSK1-L${String(num).padStart(2, '0')}`;
    await AppDataSource.query(`UPDATE practice_set SET topic = $1 WHERE id = $2`, [topicKey, s.id]);
  }
  console.log('Aligned HSK 1 Practice Sets topic keys.');

  // 2. Align HSK 2 Practice Sets topic to 'HSK2-L{xx}'
  const hsk2Sets = await AppDataSource.query(`SELECT id, title FROM practice_set WHERE "hskLevel" = 2`);
  for (let i = 0; i < hsk2Sets.length; i++) {
    const s = hsk2Sets[i];
    const match = s.title.match(/Bài (\d+)/i);
    const num = match ? parseInt(match[1], 10) : i + 1;
    const topicKey = `HSK2-L${String(num).padStart(2, '0')}`;
    await AppDataSource.query(`UPDATE practice_set SET topic = $1 WHERE id = $2`, [topicKey, s.id]);
  }
  console.log('Aligned HSK 2 Practice Sets topic keys.');

  // 3. Align HSK 3 Practice Sets topic to 'HSK3-L{xx}'
  const hsk3Sets = await AppDataSource.query(`SELECT id, title FROM practice_set WHERE "hskLevel" = 3`);
  for (let i = 0; i < hsk3Sets.length; i++) {
    const s = hsk3Sets[i];
    const match = s.title.match(/Bài (\d+)/i);
    const num = match ? parseInt(match[1], 10) : i + 1;
    const topicKey = `HSK3-L${String(num).padStart(2, '0')}`;
    await AppDataSource.query(`UPDATE practice_set SET topic = $1 WHERE id = $2`, [topicKey, s.id]);
  }
  console.log('Aligned HSK 3 Practice Sets topic keys.');

  // 4. Map vocabulary from database to lessons
  console.log('Mapping vocabulary words to HSK 1 lessons...');
  for (const [topicKey, words] of Object.entries(HSK1_VOCAB_MAP)) {
    for (const w of words) {
      await AppDataSource.query(
        `UPDATE vocabulary SET topic = $1 WHERE hanzi = $2 AND "hskLevel" = 1`,
        [topicKey, w]
      );
    }
  }

  console.log('Mapping vocabulary words to HSK 2 lessons...');
  for (const [topicKey, words] of Object.entries(HSK2_VOCAB_MAP)) {
    for (const w of words) {
      await AppDataSource.query(
        `UPDATE vocabulary SET topic = $1 WHERE hanzi = $2 AND "hskLevel" = 2`,
        [topicKey, w]
      );
    }
  }

  console.log('Mapping vocabulary words to HSK 3 lessons...');
  for (const [topicKey, words] of Object.entries(HSK3_VOCAB_MAP)) {
    for (const w of words) {
      await AppDataSource.query(
        `UPDATE vocabulary SET topic = $1 WHERE hanzi = $2 AND "hskLevel" = 3`,
        [topicKey, w]
      );
    }
  }

  // Count mapped vocabularies
  const assigned = await AppDataSource.query(
    `SELECT topic, COUNT(*) as cnt FROM vocabulary WHERE topic IS NOT NULL GROUP BY topic ORDER BY topic ASC`
  );
  console.log('Mapped vocabulary counts per lesson:');
  console.table(assigned);

  await AppDataSource.destroy();
  console.log('All topics and vocabularies aligned successfully!');
}

main().catch(console.error);
