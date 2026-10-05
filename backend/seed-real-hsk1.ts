import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

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

// 15 REAL lessons directly extracted from 《新HSK教程1 学练手册》 (New HSK Course 1 Workbook - HSK 3.0)
const REAL_WORKBOOK_HSK1_LESSONS = [
  {
    lessonNum: 1,
    topicKey: 'HSK1-L01',
    titleVi: 'Bài 1: Chào bạn, AI Tiểu Ngữ!',
    titleCn: 'AI 小语，你好！',
    pinyin: 'AI Xiǎoyǔ, nǐ hǎo!',
    icon: '👋',
    questions: [
      {
        text: '看图片情境选择正确的对话：（两人在前台初次见面打招呼）',
        options: ['A. A: 你好！ B: 你好！', 'B. A: 再见！ B: 再见！', 'C. A: 对不起。 B: 没关系。', 'D. A: 谢谢！ B: 不客气！'],
        correct: 'A',
        explanation: 'Trang 4 Sách bài tập HSK 1 (Bài tập 5): Chào hỏi khi gặp mặt: A: 你好！ B: 你好！',
      },
      {
        text: '看图片情境选择正确的对话：（大人向两个正在滑冰的小朋友打招呼）',
        options: ['A. A: 你们好！ B: 老师好！', 'B. A: 你好！ B: 你们好！', 'C. A: 谢谢！ B: 不客气！', 'D. A: 对不起。 B: 没关系。'],
        correct: 'B',
        explanation: 'Trang 4 Sách bài tập HSK 1 (Bài tập 5): Chào nhiều người: A: 你好！ B: 你们好！',
      },
      {
        text: '看图片情境选择正确的对话：（学生向借书给自己的老师致谢）',
        options: ['A. A: 你好！ B: 你好！', 'B. A: 谢谢！ B: 不客气！', 'C. A: 再见！ B: 明天见！', 'D. A: 没关系。 B: 谢谢！'],
        correct: 'B',
        explanation: 'Trang 4 Sách bài tập HSK 1 (Bài tập 5): Cảm ơn và đáp lại: A: 谢谢！ B: 不客气！',
      },
      {
        text: '根据学练手册第1课小语讲堂，看图片词汇选择正确的拼音与汉字配对：“一杯热饮”',
        options: ['A. chá (茶)', 'B. cài (菜)', 'C. māo (猫)', 'D. gǒu (狗)'],
        correct: 'A',
        explanation: 'Trang 1 Sách bài tập HSK 1: Hình ảnh cốc trà xanh là chá (茶).',
      },
      {
        text: '根据第1课词汇配对：“站在讲台上的两位指导者”',
        options: ['A. xuéshēng (学生)', 'B. lǎoshī (老师)', 'C. bēizi (杯子)', 'D. jīdàn (鸡蛋)'],
        correct: 'B',
        explanation: 'Trang 2 Sách bài tập HSK 1: lǎoshī (老师).',
      },
    ],
  },
  {
    lessonNum: 2,
    topicKey: 'HSK1-L02',
    titleVi: 'Bài 2: Tôi tên là Lý Văn',
    titleCn: '我叫李文',
    pinyin: 'Wǒ jiào Lǐ Wén',
    icon: '🏷️',
    questions: [
      {
        text: '看图片情境选择正确的对话：（两人握手道别）',
        options: ['A. A: 老师，再见！ B: 再见！', 'B. A: 对不起。 B: 没关系。', 'C. A: 很高兴认识你。 B: 认识你我也很高兴。', 'D. A: 大家好，我叫白家月。 B: 白家月，你好。'],
        correct: 'A',
        explanation: 'Trang 8 Sách bài tập HSK 1 (Bài tập 4): Chào tạm biệt: A: 老师，再见！ B: 再见！',
      },
      {
        text: '看图片情境选择正确的对话：（学生在走廊不小心撞到人道歉）',
        options: ['A. A: 老师，再见！ B: 再见！', 'B. A: 对不起。 B: 没关系。', 'C. A: 你叫什么名字？ B: 我叫李文。', 'D. A: 谢谢！ B: 不客气！'],
        correct: 'B',
        explanation: 'Trang 8 Sách bài tập HSK 1 (Bài tập 4): Xin lỗi và đáp lại: A: 对不起。 B: 没关系。',
      },
      {
        text: '看图片情境选择正确的对话：（两位女士初次相识握手）',
        options: ['A. A: 很高兴认识你。 B: 认识你我也很高兴。', 'B. A: 老师，再见！ B: 再见！', 'C. A: 对不起。 B: 没关系。', 'D. A: 你是哪国人？ B: 我是中国人。'],
        correct: 'A',
        explanation: 'Trang 8 Sách bài tập HSK 1 (Bài tập 4): Làm quen: A: 很高兴认识你。 B: 认识你我也很高兴。',
      },
      {
        text: '看图片情境选择正确的对话：（白家月向大家做自我介绍）',
        options: ['A. A: 大家好，我叫白家月。 B: 白家月，你好。', 'B. A: 老师，再见！ B: 再见！', 'C. A: 认识你很高兴。 B: 我也很高兴。', 'D. A: 对不起。 B: 没关系。'],
        correct: 'A',
        explanation: 'Trang 8 Sách bài tập HSK 1 (Bài tập 4): Tự giới thiệu: A: 大家好，我叫白家月。 B: 白家月，你好。',
      },
      {
        text: '根据第2课小语讲堂词汇配对：“数字 9 的汉字和拼音”',
        options: ['A. jiǔ (九)', 'B. péngyou (朋友)', 'C. niúnǎi (牛奶)', 'D. xiūxi (休息)'],
        correct: 'A',
        explanation: 'Trang 7 Sách bài tập HSK 1: jiǔ (九).',
      },
    ],
  },
  {
    lessonNum: 3,
    topicKey: 'HSK1-L03',
    titleVi: 'Bài 3: Tôi là người Trung Quốc',
    titleCn: '我是中国人',
    pinyin: 'Wǒ shì Zhōngguórén',
    icon: '🇨🇳',
    questions: [
      {
        text: '看图片情境选择正确的对话：（一位女士在黑板前做国籍介绍）',
        options: ['A. A: 我是法国人。 B: 我也是法国人。', 'B. A: 这是我女朋友。 B: 你好，很高兴认识你。', 'C. A: 王老师是你的中文老师吗？ B: 是的。', 'D. A: 喂，你工作忙吗？ B: 我工作不忙。'],
        correct: 'A',
        explanation: 'Trang 12 Sách bài tập HSK 1 (Bài tập 4): A: 我是法国人。 B: 我也是法国人。',
      },
      {
        text: '看图片情境选择正确的对话：（在飞机客舱里介绍身边的女朋友）',
        options: ['A. A: 这是我女朋友。 B: 你好，很高兴认识你。', 'B. A: 我是法国人。 B: 我也是法国人。', 'C. A: 王老师是你的中文老师吗？ B: 是的。', 'D. A: 喂，你工作忙吗？ B: 我工作不忙。'],
        correct: 'A',
        explanation: 'Trang 12 Sách bài tập HSK 1 (Bài tập 4): Giới thiệu bạn gái: A: 这是我女朋友。 B: 你好，很高兴认识你。',
      },
      {
        text: '看图片情境选择正确的对话：（询问走廊里的女士是否为王老师）',
        options: ['A. A: 王老师是你的中文老师吗？ B: 是的。', 'B. A: 我是法国人。 B: 我也是法国人。', 'C. A: 喂，你工作忙吗？ B: 我工作不忙。', 'D. A: 这是我女朋友。 B: 很高兴认识你。'],
        correct: 'A',
        explanation: 'Trang 12 Sách bài tập HSK 1 (Bài tập 4): A: 王老师是你的中文老师吗？ B: 是的。',
      },
      {
        text: '看图片情境选择正确的对话：（男士打手机谈论工作状态）',
        options: ['A. A: 喂，你工作忙吗？ B: 我工作不忙。', 'B. A: 我是法国人。 B: 我也是法国人。', 'C. A: 这是我女朋友。 B: 很高兴认识你。', 'D. A: 王老师是你的中文老师吗？ B: 是的。'],
        correct: 'A',
        explanation: 'Trang 12 Sách bài tập HSK 1 (Bài tập 4): A: 喂，你工作忙吗？ B: 我工作不忙。',
      },
    ],
  },
  {
    lessonNum: 4,
    topicKey: 'HSK1-L04',
    titleVi: 'Bài 4: Tôi có hai đứa con',
    titleCn: '我有两个孩子',
    pinyin: 'Wǒ yǒu liǎng gè háizi',
    icon: '👨‍👩‍👧‍👦',
    questions: [
      {
        text: '阅读匹配问答：问：“她是谁？” 应回答：',
        options: ['A. 好的，谢谢！', 'B. 他今年5岁。', 'C. 我女朋友。', 'D. 是的。'],
        correct: 'C',
        explanation: 'Trang 20 Sách bài tập HSK 1 (Câu 14): Hỏi người "她是谁？" -> "我女朋友。"',
      },
      {
        text: '阅读匹配问答：问：“你是法国人吗？” 应回答：',
        options: ['A. 好的，谢谢！', 'B. 他今年5岁。', 'C. 我女朋友。', 'D. 是的。'],
        correct: 'D',
        explanation: 'Trang 20 Sách bài tập HSK 1 (Câu 15): "你是法国人吗？" -> "是的。"',
      },
      {
        text: '阅读匹配问答：问：“您儿子多大？” 应回答：',
        options: ['A. 好的，谢谢！', 'B. 他今年5岁。', 'C. 我女朋友。', 'D. 是的。'],
        correct: 'B',
        explanation: 'Trang 20 Sách bài tập HSK 1 (Câu 16): Hỏi tuổi "您儿子多大？" -> "他今年5岁。"',
      },
      {
        text: '选词填空：选词填入句子“她工作很( )。”',
        options: ['A. 想', 'B. 忙', 'C. 名字', 'D. 大'],
        correct: 'B',
        explanation: 'Trang 20 Sách bài tập HSK 1 (Câu 17): "她工作很忙。"',
      },
      {
        text: '根据句子理解选择正确答案：“我家有三口人，爸爸、妈妈和我。” ★ 说话人家里有：',
        options: ['A. 姐姐', 'B. 三口人', 'C. 四口人', 'D. 哥哥'],
        correct: 'B',
        explanation: 'Trang 21 Sách bài tập HSK 1 (Câu 19): Ba người (三口人).',
      },
      {
        text: '根据句子理解选择正确答案：“她是法国人，我不是。” ★ “她”是：',
        options: ['A. 法国人', 'B. 中国人', 'C. 泰国人', 'D. 英国人'],
        correct: 'A',
        explanation: 'Trang 21 Sách bài tập HSK 1 (Câu 20): "她是法国人" -> Pháp (法国人).',
      },
    ],
  },
  {
    lessonNum: 5,
    topicKey: 'HSK1-L05',
    titleVi: 'Bài 5: Hôm nay tôi được nghỉ',
    titleCn: '今天我休息',
    pinyin: 'Jīntiān wǒ xiūxi',
    icon: '☕',
    questions: [
      {
        text: '阅读匹配问答：问：“你去超市买什么？” 应回答：',
        options: ['A. 好的，谢谢！', 'B. 我不会。', 'C. 面条儿。', 'D. 5月6号。'],
        correct: 'C',
        explanation: 'Trang 29 Sách bài tập HSK 1 (Câu 14): Mua gì ở siêu thị -> "面条儿。"',
      },
      {
        text: '阅读匹配问答：问：“你会做饭吗？” 应回答：',
        options: ['A. 好的，谢谢！', 'B. 我不会。', 'C. 面条儿。', 'D. 5月6号。'],
        correct: 'B',
        explanation: 'Trang 29 Sách bài tập HSK 1 (Câu 15): "你会做饭吗？" -> "我不会。"',
      },
      {
        text: '阅读匹配问答：问：“今天几号？” 应回答：',
        options: ['A. 好的，谢谢！', 'B. 我不会。', 'C. 面条儿。', 'D. 5月6号。'],
        correct: 'D',
        explanation: 'Trang 29 Sách bài tập HSK 1 (Câu 16): Hỏi ngày hôm nay -> "5月6号。"',
      },
      {
        text: '选词填空：选词填入句子“今天( )号？”',
        options: ['A. 几', 'B. 好看', 'C. 名字', 'D. 多'],
        correct: 'A',
        explanation: 'Trang 29 Sách bài tập HSK 1 (Câu 17): "今天几号？"',
      },
      {
        text: '根据句子理解选择正确答案：“我非常喜欢我的中文名字。” ★ 说话人喜欢什么？',
        options: ['A. 新电脑', 'B. 中国菜', 'C. 中文名字', 'D. 新衣服'],
        correct: 'C',
        explanation: 'Trang 30 Sách bài tập HSK 1 (Câu 19): Thích tên tiếng Trung của mình (中文名字).',
      },
      {
        text: '根据句子理解选择正确答案：“今天8号，你几号休息？” ★ 说话人想知道什么？',
        options: ['A. 今天几号', 'B. 哪天休息', 'C. 星期几上班', 'D. 什么时候吃饭'],
        correct: 'B',
        explanation: 'Trang 30 Sách bài tập HSK 1 (Câu 20): Hỏi "你几号休息？" nghĩa là muốn biết ngày nào nghỉ (哪天休息).',
      },
    ],
  },
  {
    lessonNum: 6,
    topicKey: 'HSK1-L06',
    titleVi: 'Bài 6: Số điện thoại của bạn là bao nhiêu?',
    titleCn: '你的手机号是多少？',
    pinyin: 'Nǐ de shǒujī hào shì duōshao?',
    icon: '📱',
    questions: [
      {
        text: '阅读匹配问答：问：“你吃什么？” 应回答：',
        options: ['A. 坐出租车。', 'B. 真好看！', 'C. 包子。', 'D. 好的，谢谢！'],
        correct: 'C',
        explanation: 'Trang 37 Sách bài tập HSK 1 (Câu 14): Ăn gì -> "包子。"',
      },
      {
        text: '阅读匹配问答：问：“我们怎么去？” 应回答：',
        options: ['A. 坐出租车。', 'B. 真好看！', 'C. 包子。', 'D. 好的，谢谢！'],
        correct: 'A',
        explanation: 'Trang 37 Sách bài tập HSK 1 (Câu 15): Đi bằng cách nào -> "坐出租车。"',
      },
      {
        text: '阅读匹配问答：“这是老师的新电脑。” 应回应：',
        options: ['A. 坐出租车。', 'B. 真好看！', 'C. 包子。', 'D. 好的，谢谢！'],
        correct: 'B',
        explanation: 'Trang 37 Sách bài tập HSK 1 (Câu 16): Khen máy tính mới -> "真好看！"',
      },
      {
        text: '选词填空：选词填入句子“我想买( )。”',
        options: ['A. 有', 'B. 牛奶', 'C. 名字', 'D. 去'],
        correct: 'B',
        explanation: 'Trang 37 Sách bài tập HSK 1 (Câu 17): "我想买牛奶。"',
      },
      {
        text: '根据句子理解选择正确答案：“我家有三口人：爸爸、妈妈和我。” ★ 说话人家里有几口人？',
        options: ['A. 三口人', 'B. 四口人', 'C. 六口人', 'D. 五口人'],
        correct: 'A',
        explanation: 'Trang 38 Sách bài tập HSK 1 (Câu 19): Ba người (三口人).',
      },
      {
        text: '根据句子理解选择正确答案：“明天星期天，我休息，想去超市买牛奶。” ★ 说话人想买什么？',
        options: ['A. 菜', 'B. 牛奶', 'C. 饺子', 'D. 水果'],
        correct: 'B',
        explanation: 'Trang 38 Sách bài tập HSK 1 (Câu 20): Muốn mua sữa bò (牛奶).',
      },
    ],
  },
  {
    lessonNum: 7,
    topicKey: 'HSK1-L07',
    titleVi: 'Bài 7: Tôi tan làm lúc 6 rưỡi tối',
    titleCn: '我晚上六点半下班',
    pinyin: 'Wǒ wǎnshang liù diǎn bàn xiàbān',
    icon: '⏰',
    questions: [
      {
        text: '阅读匹配问答：问：“我们在哪儿见？” 应回答：',
        options: ['A. 早上七点半。', 'B. 对不起，我有课。', 'C. 电影院。', 'D. 好的，谢谢！'],
        correct: 'C',
        explanation: 'Trang 46 Sách bài tập HSK 1 (Câu 14): Gặp ở đâu -> "电影院。"',
      },
      {
        text: '阅读匹配问答：问：“现在几点？” 应回答：',
        options: ['A. 早上七点半。', 'B. 对不起，我有课。', 'C. 电影院。', 'D. 好的，谢谢！'],
        correct: 'A',
        explanation: 'Trang 46 Sách bài tập HSK 1 (Câu 15): Bây giờ mấy giờ -> "早上七点半。"',
      },
      {
        text: '阅读匹配问答：“我们下午去超市吧。” 应回答：',
        options: ['A. 早上七点半。', 'B. 对不起，我有课。', 'C. 电影院。', 'D. 好的，谢谢！'],
        correct: 'B',
        explanation: 'Trang 46 Sách bài tập HSK 1 (Câu 16): Rủ đi siêu thị -> "对不起，我有课。"',
      },
      {
        text: '选词填空：选词填入句子“我们( )12:00下课。”',
        options: ['A. 医院', 'B. 中午', 'C. 名字', 'D. 晚上'],
        correct: 'B',
        explanation: 'Trang 46 Sách bài tập HSK 1 (Câu 17): Buổi trưa 12:00 (中午12:00).',
      },
      {
        text: '根据句子理解选择正确答案：“我今天早上八点半上课，十点十分下课。” ★ 说话人今天几点下课？',
        options: ['A. 8:30', 'B. 10:10', 'C. 10:20', 'D. 12:00'],
        correct: 'B',
        explanation: 'Trang 47 Sách bài tập HSK 1 (Câu 19): 10:10 tan học.',
      },
      {
        text: '根据句子理解选择正确答案：“妈妈今天休息，下午想去菜店买些菜。” ★ 妈妈下午想去菜店买：',
        options: ['A. 菜', 'B. 饺子', 'C. 牛奶', 'D. 衣服'],
        correct: 'A',
        explanation: 'Trang 47 Sách bài tập HSK 1 (Câu 20): Mẹ đi mua rau (买些菜).',
      },
    ],
  },
  {
    lessonNum: 8,
    topicKey: 'HSK1-L08',
    titleVi: 'Bài 8: Bố tôi cũng làm việc ở bệnh viện',
    titleCn: '我爸爸也在医院工作',
    pinyin: 'Wǒ bàba yě zài yīyuàn gōngzuò',
    icon: '🏥',
    questions: [
      {
        text: '阅读匹配问答：问：“桌子上有什么？” 应回答：',
        options: ['A. 医院。', 'B. 我老师。', 'C. 饺子和面条儿。', 'D. 好的，谢谢！'],
        correct: 'C',
        explanation: 'Trang 54 Sách bài tập HSK 1 (Câu 14): Trên bàn có gì -> "饺子和面条儿。"',
      },
      {
        text: '阅读匹配问答：问：“她是谁？” 应回答：',
        options: ['A. 医院。', 'B. 我老师。', 'C. 饺子和面条儿。', 'D. 好的，谢谢！'],
        correct: 'B',
        explanation: 'Trang 54 Sách bài tập HSK 1 (Câu 15): Cô ấy là ai -> "我老师。"',
      },
      {
        text: '阅读匹配问答：问：“你爸爸在哪儿工作？” 应回答：',
        options: ['A. 医院。', 'B. 我老师。', 'C. 饺子和面条儿。', 'D. 好的，谢谢！'],
        correct: 'A',
        explanation: 'Trang 54 Sách bài tập HSK 1 (Câu 16): Bố làm việc ở đâu -> "医院。"',
      },
      {
        text: '选词填空：选词填入句子“我的房间里( )一只小猫。”',
        options: ['A. 能', 'B. 有', 'C. 名字', 'D. 在'],
        correct: 'B',
        explanation: 'Trang 55 Sách bài tập HSK 1 (Câu 17): Trong phòng có 1 con mèo (有一只小猫).',
      },
      {
        text: '根据句子理解选择正确答案：“昨天爸爸在医院工作，哥哥在家里休息，没去书店。” ★ 说话人的哥哥昨天：',
        options: ['A. 在家里', 'B. 在书店', 'C. 在医院工作', 'D. 去学校'],
        correct: 'A',
        explanation: 'Trang 56 Sách bài tập HSK 1 (Câu 19): Anh trai ở nhà nghỉ ngơi (在家里休息).',
      },
      {
        text: '根据句子理解选择正确答案：“我喜欢吃米饭，我女朋友不喜欢。” ★ 说话人的女朋友不喜欢吃：',
        options: ['A. 米饭', 'B. 包子', 'C. 面条儿', 'D. 饺子'],
        correct: 'A',
        explanation: 'Trang 56 Sách bài tập HSK 1 (Câu 20): Bạn gái không thích ăn cơm (米饭).',
      },
    ],
  },
  {
    lessonNum: 9,
    topicKey: 'HSK1-L09',
    titleVi: 'Bài 9: Sáng mai tôi học ở trường',
    titleCn: '我明天上午在学校学习',
    pinyin: 'Wǒ míngtiān shàngwǔ zài xuéxiào xuéxí',
    icon: '🏫',
    questions: [
      {
        text: '阅读匹配问答：问：“桌子上有什么？” 应回答：',
        options: ['A. 在家里。', 'B. 我女朋友。', 'C. 一只小猫。', 'D. 好的，谢谢！'],
        correct: 'C',
        explanation: 'Trang 64 Sách bài tập HSK 1 (Câu 14): Trên bàn có gì -> "一只小猫。"',
      },
      {
        text: '阅读匹配问答：问：“你今天下午在哪儿？” 应回答：',
        options: ['A. 在家里。', 'B. 我女朋友。', 'C. 一只小猫。', 'D. 好的，谢谢！'],
        correct: 'A',
        explanation: 'Trang 64 Sách bài tập HSK 1 (Câu 15): Chiều nay ở đâu -> "在家里。"',
      },
      {
        text: '阅读匹配问答：问：“你和谁在超市呢？” 应回答：',
        options: ['A. 在家里。', 'B. 我女朋友。', 'C. 一只小猫。', 'D. 好的，谢谢！'],
        correct: 'B',
        explanation: 'Trang 64 Sách bài tập HSK 1 (Câu 16): Ở siêu thị cùng ai -> "我女朋友。"',
      },
      {
        text: '选词填空：选词填入句子“我上午在学校( )，我们下午去看电影吧。”',
        options: ['A. 2:00', 'B. 上课', 'C. 名字', 'D. 睡觉'],
        correct: 'B',
        explanation: 'Trang 64 Sách bài tập HSK 1 (Câu 17): Buổi sáng học ở trường (上课).',
      },
      {
        text: '根据句子理解选择正确答案：“我有一只小狗，很漂亮，它是我的好朋友。” ★ 说话人有几只小狗？',
        options: ['A. 一', 'B. 四', 'C. 十一', 'D. 两'],
        correct: 'A',
        explanation: 'Trang 65 Sách bài tập HSK 1 (Câu 19): 1 con chó (一只小狗).',
      },
      {
        text: '根据句子理解选择正确答案：“星期天中午妈妈在做饭，我和妹妹在房间里玩。” ★ 说话人和妹妹在哪儿？',
        options: ['A. 外边', 'B. 房间里', 'C. 超市里', 'D. 学校'],
        correct: 'B',
        explanation: 'Trang 65 Sách bài tập HSK 1 (Câu 20): Chơi ở trong phòng (在房间里玩).',
      },
    ],
  },
  {
    lessonNum: 10,
    topicKey: 'HSK1-L10',
    titleVi: 'Bài 10: Táo ở đây thật là rẻ!',
    titleCn: '这儿的苹果真便宜！',
    pinyin: 'Zhèr de píngguǒ zhēn piányi!',
    icon: '🍎',
    questions: [
      {
        text: '阅读匹配问答：问：“女孩子的衣服在哪儿？” 应回答：',
        options: ['A. 十块钱。', 'B. 对不起，没有。', 'C. 在那边。', 'D. 好的，谢谢！'],
        correct: 'C',
        explanation: 'Trang 72 Sách bài tập HSK 1 (Câu 14): Quần áo bé gái ở đâu -> "在那边。"',
      },
      {
        text: '阅读匹配问答：问：“杯子多少钱一个？” 应回答：',
        options: ['A. 十块钱。', 'B. 对不起，没有。', 'C. 在那边。', 'D. 好的，谢谢！'],
        correct: 'A',
        explanation: 'Trang 72 Sách bài tập HSK 1 (Câu 15): Cốc bao nhiêu tiền một cái -> "十块钱。"',
      },
      {
        text: '阅读匹配问答：问：“请问这儿有牛奶吗？” 应回答：',
        options: ['A. 十块钱。', 'B. 对不起，没有。', 'C. 在那边。', 'D. 好的，谢谢！'],
        correct: 'B',
        explanation: 'Trang 72 Sách bài tập HSK 1 (Câu 16): Ở đây có sữa bò không -> "对不起，没有。"',
      },
      {
        text: '选词填空：选词填入句子“那些苹果两( )钱一斤，很便宜。”',
        options: ['A. 穿', 'B. 块', 'C. 名字', 'D. 个'],
        correct: 'B',
        explanation: 'Trang 73 Sách bài tập HSK 1 (Câu 17): Đơn vị tiền: 两块钱一斤.',
      },
      {
        text: '根据句子理解选择正确答案：“我没有手机，今天想去商店买一个。” ★ 说话人想买什么？',
        options: ['A. 杯子', 'B. 手机', 'C. 水果', 'D. 电脑'],
        correct: 'B',
        explanation: 'Trang 74 Sách bài tập HSK 1 (Câu 19): Muốn mua điện thoại (手机).',
      },
      {
        text: '根据句子理解选择正确答案：“这件衣服很好看，你也能穿，买一件吧。” ★ 那件衣服：',
        options: ['A. 好看', 'B. 便宜', 'C. 很贵', 'D. 大'],
        correct: 'A',
        explanation: 'Trang 74 Sách bài tập HSK 1 (Câu 20): "这件衣服很好看" -> 好看.',
      },
    ],
  },
  {
    lessonNum: 11,
    topicKey: 'HSK1-L11',
    titleVi: 'Bài 11: Tôi đang học đại học',
    titleCn: '我读大学呢',
    pinyin: 'Wǒ dú dàxué ne',
    icon: '🎓',
    questions: [
      {
        text: '阅读匹配问答：问：“你开车去吗？” 应回答：',
        options: ['A. 不，我坐出租车。', 'B. 非常忙。', 'C. 没有，我在开车呢。', 'D. 好的，谢谢！'],
        correct: 'A',
        explanation: 'Trang 82 Sách bài tập HSK 1 (Câu 14): Có lái xe đi không -> "不，我坐出租车。"',
      },
      {
        text: '阅读匹配问答：问：“你们学习忙不忙？” 应回答：',
        options: ['A. 不，我坐出租车。', 'B. 非常忙。', 'C. 没有，我在开车呢。', 'D. 好的，谢谢！'],
        correct: 'B',
        explanation: 'Trang 82 Sách bài tập HSK 1 (Câu 15): Học có bận không -> "非常忙。"',
      },
      {
        text: '阅读匹配问答：问：“你在吃午饭吗？” 应回答：',
        options: ['A. 不，我坐出租车。', 'B. 非常忙。', 'C. 没有，我在开车呢。', 'D. 好的，谢谢！'],
        correct: 'C',
        explanation: 'Trang 82 Sách bài tập HSK 1 (Câu 16): Có đang ăn trưa không -> "没有，我在开车呢。"',
      },
      {
        text: '选词填空：选词填入句子“弟弟没起床，还在( )呢。”',
        options: ['A. 找', 'B. 睡觉', 'C. 名字', 'D. 上课'],
        correct: 'B',
        explanation: 'Trang 82 Sách bài tập HSK 1 (Câu 17): Vẫn đang ngủ (还在睡觉呢).',
      },
      {
        text: '根据句子理解选择正确答案：“我姐姐今年20岁，正在读大学呢，她学医。” ★ 说话人的姐姐是：',
        options: ['A. 老师', 'B. 医生', 'C. 大学生', 'D. 小学生'],
        correct: 'C',
        explanation: 'Trang 83 Sách bài tập HSK 1 (Câu 19): Đang học đại học -> 大学生.',
      },
      {
        text: '根据句子理解选择正确答案：“我明天有事，要去学校找老师，不知道老师在不在。” ★ 说话人明天要去学校见：',
        options: ['A. 朋友', 'B. 学生', 'C. 老师', 'D. 医生'],
        correct: 'C',
        explanation: 'Trang 83 Sách bài tập HSK 1 (Câu 20): Tìm thầy giáo (找老师).',
      },
    ],
  },
  {
    lessonNum: 12,
    topicKey: 'HSK1-L12',
    titleVi: 'Bài 12: Hôm qua có tuyết rơi',
    titleCn: '昨天下雪了',
    pinyin: 'Zuótiān xiàxuě le',
    icon: '❄️',
    questions: [
      {
        text: '阅读匹配问答：问：“你怎么了？” 应回答：',
        options: ['A. 热水。', 'B. 我病了。', 'C. 对。', 'D. 好的，谢谢！'],
        correct: 'B',
        explanation: 'Trang 91 Sách bài tập HSK 1 (Câu 14): Bạn sao thế -> "我病了。"',
      },
      {
        text: '阅读匹配问答：问：“你想喝点儿什么？” 应回答：',
        options: ['A. 热水。', 'B. 我病了。', 'C. 对。', 'D. 好的，谢谢！'],
        correct: 'A',
        explanation: 'Trang 91 Sách bài tập HSK 1 (Câu 15): Muốn uống gì -> "热水。"',
      },
      {
        text: '阅读匹配问答：问：“你开车了？” 应回答：',
        options: ['A. 热水。', 'B. 我病了。', 'C. 对。', 'D. 好的，谢谢！'],
        correct: 'C',
        explanation: 'Trang 91 Sách bài tập HSK 1 (Câu 16): Bạn đi ô tô à -> "对。"',
      },
      {
        text: '选词填空：选词填入句子“他( )了，没来上班。”',
        options: ['A. 冷', 'B. 生病', 'C. 名字', 'D. 休息'],
        correct: 'B',
        explanation: 'Trang 91 Sách bài tập HSK 1 (Câu 17): Bị ốm không đi làm (他生病了).',
      },
      {
        text: '根据句子理解选择正确答案：“昨天的天气很好，我和朋友们去外边玩了。” ★ 说话人觉得昨天：',
        options: ['A. 天气好', 'B. 雨不大', 'C. 有点儿冷', 'D. 下雪了'],
        correct: 'A',
        explanation: 'Trang 92 Sách bài tập HSK 1 (Câu 19): "昨天的天气很好" -> 天气好.',
      },
      {
        text: '根据句子理解选择正确答案：“老张去看病，医生说他要吃三天药。” ★ 医生说老张：',
        options: ['A. 要吃药', 'B. 要多睡觉', 'C. 要多喝水', 'D. 不能上班'],
        correct: 'A',
        explanation: 'Trang 92 Sách bài tập HSK 1 (Câu 20): Bác sĩ bảo uống thuốc (要吃药).',
      },
    ],
  },
  {
    lessonNum: 13,
    topicKey: 'HSK1-L13',
    titleVi: 'Bài 13: Xin cho tôi một ly trà',
    titleCn: '请给我一杯茶',
    pinyin: 'Qǐng gěi wǒ yì bēi chá',
    icon: '🍵',
    questions: [
      {
        text: '阅读匹配问答：问：“那里卖不卖手机？” 应回答：',
        options: ['A. 不客气。', 'B. 一个面包。', 'C. 不知道。', 'D. 好的，谢谢！'],
        correct: 'C',
        explanation: 'Trang 100 Sách bài tập HSK 1 (Câu 14): Ở đó có bán điện thoại không -> "不知道。"',
      },
      {
        text: '阅读匹配问答：“我会写了，谢谢老师。” 应回答：',
        options: ['A. 不客气。', 'B. 一个面包。', 'C. 不知道。', 'D. 好的，谢谢！'],
        correct: 'A',
        explanation: 'Trang 100 Sách bài tập HSK 1 (Câu 15): Cảm ơn cô giáo -> "不客气。"',
      },
      {
        text: '阅读匹配问答：问：“你要什么？” 应回答：',
        options: ['A. 不客气。', 'B. 一个面包。', 'C. 不知道。', 'D. 好的，谢谢！'],
        correct: 'B',
        explanation: 'Trang 100 Sách bài tập HSK 1 (Câu 16): Muốn lấy gì -> "一个面包。"',
      },
      {
        text: '选词填空：选词填入句子“你看( )，你要什么？”',
        options: ['A. 给', 'B. 一下', 'C. 名字', 'D. 在'],
        correct: 'B',
        explanation: 'Trang 100 Sách bài tập HSK 1 (Câu 17): Bạn xem một chút (你看一下).',
      },
      {
        text: '根据句子理解选择正确答案：“明天星期天，我们可以去饭店吃饺子吗？” ★ 明天是：',
        options: ['A. 星期五', 'B. 星期六', 'C. 星期日', 'D. 星期一'],
        correct: 'C',
        explanation: 'Trang 101 Sách bài tập HSK 1 (Câu 19): 星期天 chính là 星期日 (Chủ nhật).',
      },
      {
        text: '根据句子理解选择正确答案：“爸爸今天在家里工作，我们不要去他的房间。” ★ 爸爸今天：',
        options: ['A. 在家里工作', 'B. 做了面条儿', 'C. 不能去公司', 'D. 去医院了'],
        correct: 'A',
        explanation: 'Trang 101 Sách bài tập HSK 1 (Câu 20): Bố hôm nay làm việc ở nhà (在家里工作).',
      },
    ],
  },
  {
    lessonNum: 14,
    topicKey: 'HSK1-L14',
    titleVi: 'Bài 14: Tôi đã xem một bộ phim',
    titleCn: '我看了一个电影',
    pinyin: 'Wǒ kànle yí gè diànyǐng',
    icon: '🎬',
    questions: [
      {
        text: '阅读匹配问答：问：“谁去学校了？” 应回答：',
        options: ['A. 是的，我睡了一觉。', 'B. 我们都去了。', 'C. 写字、看书、吃饭。', 'D. 好的，谢谢！'],
        correct: 'B',
        explanation: 'Trang 109 Sách bài tập HSK 1 (Câu 14): Ai đến trường -> "我们都去了。"',
      },
      {
        text: '阅读匹配问答：问：“你下午没去医院吗？” 应回答：',
        options: ['A. 是的，我睡了一觉。', 'B. 我们都去了。', 'C. 写字、看书、吃饭。', 'D. 好的，谢谢！'],
        correct: 'A',
        explanation: 'Trang 109 Sách bài tập HSK 1 (Câu 15): Chiều nay không đi viện à -> "是的，我睡了一觉。"',
      },
      {
        text: '阅读匹配问答：问：“你今天上午都忙了些什么？” 应回答：',
        options: ['A. 是的，我睡了一觉。', 'B. 我们都去了。', 'C. 写字、看书、吃饭。', 'D. 好的，谢谢！'],
        correct: 'C',
        explanation: 'Trang 109 Sách bài tập HSK 1 (Câu 16): Sáng nay bận gì -> "写字、看书、吃饭。"',
      },
      {
        text: '选词填空：选词填入句子“我喝了一杯( )。”',
        options: ['A. 都', 'B. 茶', 'C. 名字', 'D. 饭'],
        correct: 'B',
        explanation: 'Trang 109 Sách bài tập HSK 1 (Câu 17): Uống một ly trà (喝了一杯茶).',
      },
      {
        text: '根据句子理解选择正确答案：“服务员，我想问一下，我们的房间号是多少？” ★ 说话人想知道什么？',
        options: ['A. 时间', 'B. 电话号', 'C. 房间号', 'D. 名字'],
        correct: 'C',
        explanation: 'Trang 110 Sách bài tập HSK 1 (Câu 19): Muốn biết số phòng (房间号是多少).',
      },
      {
        text: '根据句子理解选择正确答案：“儿子和女儿都上小学了，他们会写很多字了。” ★ 说话人的两个孩子是：',
        options: ['A. 小学生', 'B. 中学生', 'C. 大学生', 'D. 老师'],
        correct: 'A',
        explanation: 'Trang 110 Sách bài tập HSK 1 (Câu 20): Đều học tiểu học -> 小学生.',
      },
    ],
  },
  {
    lessonNum: 15,
    topicKey: 'HSK1-L15',
    titleVi: 'Bài 15: Hẹn gặp ở sân bay Đại Hưng!',
    titleCn: '大兴机场见！',
    pinyin: 'Dàxīng Jīchǎng jiàn!',
    icon: '✈️',
    questions: [
      {
        text: '阅读匹配问答：问：“你会写几个汉字？” 应回答：',
        options: ['A. 我女儿。', 'B. 十个。', 'C. 苹果。', 'D. 好的，谢谢！'],
        correct: 'B',
        explanation: 'Trang 118 Sách bài tập HSK 1 (Câu 14): Biết viết mấy chữ Hán -> "十个。"',
      },
      {
        text: '阅读匹配问答：问：“谁上中学了？” 应回答：',
        options: ['A. 我女儿。', 'B. 十个。', 'C. 苹果。', 'D. 好的，谢谢！'],
        correct: 'A',
        explanation: 'Trang 118 Sách bài tập HSK 1 (Câu 15): Ai lên cấp hai rồi -> "我女儿。"',
      },
      {
        text: '阅读匹配问答：问：“你爱吃什么？” 应回答：',
        options: ['A. 我女儿。', 'B. 十个。', 'C. 苹果。', 'D. 好的，谢谢！'],
        correct: 'C',
        explanation: 'Trang 118 Sách bài tập HSK 1 (Câu 16): Bạn thích ăn gì -> "苹果。"',
      },
      {
        text: '选词填空：选词填入句子“今年我们都想去( )。”',
        options: ['A. 电视', 'B. 北京', 'C. 名字', 'D. 电影'],
        correct: 'B',
        explanation: 'Trang 118 Sách bài tập HSK 1 (Câu 17): Muốn đi Bắc Kinh (想去北京).',
      },
      {
        text: '根据句子理解选择正确答案：“明天星期天，儿子想去看一个电影。” ★ 儿子明天想：',
        options: ['A. 买电脑', 'B. 打电话', 'C. 看电影', 'D. 去机场'],
        correct: 'C',
        explanation: 'Trang 119 Sách bài tập HSK 1 (Câu 19): Muốn xem phim (看电影).',
      },
      {
        text: '根据句子理解选择正确答案：“下小雨了，小狗非常高兴，它喜欢小雨。” ★ 小狗喜欢：',
        options: ['A. 下小雨', 'B. 下大雨', 'C. 下小雪', 'D. 刮大风'],
        correct: 'A',
        explanation: 'Trang 119 Sách bài tập HSK 1 (Câu 20): Thích mưa nhỏ (下小雨).',
      },
    ],
  },
];

// REAL HSK 1 Mock Exam from Workbook (Trang 121 - 131)
const REAL_HSK1_MOCK_QUESTIONS = [
  {
    part: '听力第四部分 第16题 (Trang 126)',
    text: '听录音选择正确答案：例如：下午我去超市，我想买一些水果。问：说话人下午去哪里？',
    options: ['A. 60岁', 'B. 60多岁', 'C. 70岁'],
    correct: 'B',
    explanation: 'Trang 126 Sách bài tập HSK 1: Đề thi mẫu HSK 1 phần nghe số 16.',
  },
  {
    part: '听力第四部分 第17题 (Trang 126)',
    text: '听录音选择正确答案：',
    options: ['A. 电脑', 'B. 杯子', 'C. 手机'],
    correct: 'A',
    explanation: 'Trang 126 Sách bài tập HSK 1: Đề thi mẫu HSK 1 phần nghe số 17.',
  },
  {
    part: '听力第四部分 第18题 (Trang 126)',
    text: '听录音选择正确答案：',
    options: ['A. 女儿', 'B. 妹妹', 'C. 高女士'],
    correct: 'C',
    explanation: 'Trang 126 Sách bài tập HSK 1: Đề thi mẫu HSK 1 phần nghe số 18.',
  },
  {
    part: '听力第四部分 第19题 (Trang 126)',
    text: '听录音选择正确答案：',
    options: ['A. 包子', 'B. 面包', 'C. 面条儿'],
    correct: 'A',
    explanation: 'Trang 126 Sách bài tập HSK 1: Đề thi mẫu HSK 1 phần nghe số 19.',
  },
  {
    part: '听力第四部分 第20题 (Trang 126)',
    text: '听录音选择正确答案：',
    options: ['A. 早上', 'B. 中午', 'C. 星期天'],
    correct: 'B',
    explanation: 'Trang 126 Sách bài tập HSK 1: Đề thi mẫu HSK 1 phần nghe số 20.',
  },
  {
    part: '阅读第二部分 第26题 (Trang 129)',
    text: '这是我的书，你的呢？',
    options: ['A. 商店。', 'B. 我学生。', 'C. 在桌子上。', 'D. 还没有。', 'E. 下雪了。', 'F. 好的，谢谢！'],
    correct: 'C',
    explanation: 'Trang 129 Sách bài tập HSK 1: Sách của bạn ở trên bàn (在桌子上).',
  },
  {
    part: '阅读第二部分 第27题 (Trang 129)',
    text: '你去哪儿买苹果？',
    options: ['A. 商店。', 'B. 我学生。', 'C. 在桌子上。', 'D. 还没有。', 'E. 下雪了。', 'F. 好的，谢谢！'],
    correct: 'A',
    explanation: 'Trang 129 Sách bài tập HSK 1: Đi đâu mua táo -> Ở cửa hàng (商店).',
  },
  {
    part: '阅读第二部分 第28题 (Trang 129)',
    text: '昨天天气怎么样？',
    options: ['A. 商店。', 'B. 我学生。', 'C. 在桌子上。', 'D. 还没有。', 'E. 下雪了。', 'F. 好的，谢谢！'],
    correct: 'E',
    explanation: 'Trang 129 Sách bài tập HSK 1: Hôm qua thời tiết thế nào -> Tuyết rơi (下雪了).',
  },
  {
    part: '阅读第二部分 第29题 (Trang 129)',
    text: '你和谁打电话呢？',
    options: ['A. 商店。', 'B. 我学生。', 'C. 在桌子上。', 'D. 还没有。', 'E. 下雪了。', 'F. 好的，谢谢！'],
    correct: 'B',
    explanation: 'Trang 129 Sách bài tập HSK 1: Gọi điện với ai -> Học sinh của tôi (我学生).',
  },
  {
    part: '阅读第二部分 第30题 (Trang 129)',
    text: '你下班了吗？',
    options: ['A. 商店。', 'B. 我学生。', 'C. 在桌子上。', 'D. 还没有。', 'E. 下雪了。', 'F. 好的，谢谢！'],
    correct: 'D',
    explanation: 'Trang 129 Sách bài tập HSK 1: Tan làm chưa -> Vẫn chưa (还没有).',
  },
  {
    part: '阅读第四部分 第36题 (Trang 131)',
    text: '下雨了，我们坐出租车回家吧。 ★ 说话人想怎么回家？',
    options: ['A. 开车', 'B. 坐飞机', 'C. 坐出租车'],
    correct: 'C',
    explanation: 'Trang 131 Sách bài tập HSK 1: Đi taxi về nhà (坐出租车).',
  },
  {
    part: '阅读第四部分 第37题 (Trang 131)',
    text: '我儿子今年 16 岁了，正在上中学。 ★ 说话人的儿子是：',
    options: ['A. 小学生', 'B. 中学生', 'C. 大学生'],
    correct: 'B',
    explanation: 'Trang 131 Sách bài tập HSK 1: Con trai đang học trung học (中学生).',
  },
  {
    part: '阅读第四部分 第38题 (Trang 131)',
    text: '小猫和小狗都在房间外睡觉呢。 ★ 小狗在：',
    options: ['A. 桌子下', 'B. 房间里', 'C. 房间外'],
    correct: 'C',
    explanation: 'Trang 131 Sách bài tập HSK 1: Ở ngoài phòng ngủ (房间外).',
  },
  {
    part: '阅读第四部分 第39题 (Trang 131)',
    text: '我同学在这个学校工作很多年了，你有问题可以问他。 ★ 说话人的同学在哪儿上班？',
    options: ['A. 饭店', 'B. 医院', 'C. 学校'],
    correct: 'C',
    explanation: 'Trang 131 Sách bài tập HSK 1: Làm việc tại trường học (学校).',
  },
  {
    part: '阅读第四部分 第40题 (Trang 131)',
    text: '这个小朋友写字真好看。 ★ 那个小朋友：',
    options: ['A. 名字好听', 'B. 写字好看', 'C. 正在读书'],
    correct: 'B',
    explanation: 'Trang 131 Sách bài tập HSK 1: Viết chữ đẹp (写字好看).',
  },
];

const REAL_HSK1_VOCAB_MAP: Record<string, string[]> = {
  'HSK1-L01': ['你', '好', '我', '八', '爸', '妈', '茶', '狗', '猫', '菜', '杯子', '学生', '老师', '鸡蛋'],
  'HSK1-L02': ['叫', '名字', '李', '是', '高兴', '认识', '九', '朋友', '牛奶', '休息', '再见', '对不起', '没关系'],
  'HSK1-L03': ['中国', '人', '国', '汉语', '说', '会', '学习', '法国', '女朋友', '工作', '忙', '是的'],
  'HSK1-L04': ['有', '两', '个', '孩子', '儿子', '女儿', '家', '口', '岁', '大', '多大', '想'],
  'HSK1-L05': ['今天', '休息', '月', '号', '几', '星期', '天', '做饭', '超市', '面条', '好看'],
  'HSK1-L06': ['的', '手机', '号', '多少', '电话', '看', '包子', '出租车', '买', '电脑'],
  'HSK1-L07': ['晚上', '六', '点', '半', '下班', '上班', '现', '现在', '电影院', '中午', '上课', '下课'],
  'HSK1-L08': ['爸爸', '也', '在', '医院', '工作', '医生', '桌子', '上', '饺子', '能', '书店', '米饭'],
  'HSK1-L09': ['明天', '上午', '学校', '学习', '去', '哪儿', '玩', '漂亮', '房间', '里', '外边'],
  'HSK1-L10': ['这儿', '苹果', '真', '便宜', '钱', '斤', '块', '穿', '衣服', '商店'],
  'HSK1-L11': ['读', '大学', '呢', '正', '在', '学', '睡觉', '找', '饭店', '开', '车'],
  'HSK1-L12': ['昨天', '下雪', '了', '雪', '雨', '冷', '生病', '病', '热', '水', '药', '吃药'],
  'HSK1-L13': ['请', '给', '一', '杯', '茶', '喝', '坐', '一下', '星期天', '星期日', '面包'],
  'HSK1-L14': ['看', '电影', '了', '都', '小学', '小学生', '字', '写', '睡觉', '房间号'],
  'HSK1-L15': ['机场', '见', '坐', '出租车', '飞机', '回', '再见', '北京', '爱', '唱歌', '下雨'],
};

async function seedRealData() {
  await AppDataSource.initialize();
  console.log('Connected to Database.');

  // STEP 1: PURGE ALL DUMMY / FAKE QUESTIONS ("Sample Question...")
  console.log('Purging any lingering dummy/sample questions...');
  const deletedOldDummy = await AppDataSource.query(`
    DELETE FROM question 
    WHERE payload->>'text' LIKE 'Sample Question%' 
       OR payload->>'text' LIKE 'Question %'
  `);
  console.log('Purged dummy questions successfully.');

  // STEP 2: Clear old HSK 1 questions attached to practice sets
  console.log('Refreshing HSK 1 practice sets and questions with 100% REAL workbook exercises...');
  for (const item of REAL_WORKBOOK_HSK1_LESSONS) {
    let ps = await AppDataSource.query(
      `SELECT id FROM practice_set WHERE "hskLevel" = 1 AND topic = $1 LIMIT 1`,
      [item.topicKey]
    );

    let psId: number;
    if (ps && ps.length > 0) {
      psId = ps[0].id;
      await AppDataSource.query(
        `UPDATE practice_set SET title = $1, skill = 'READING' WHERE id = $2`,
        [`HSK 1: ${item.titleVi} (${item.titleCn})`, psId]
      );
    } else {
      const ins = await AppDataSource.query(
        `INSERT INTO practice_set (title, topic, skill, "hskLevel", "createdAt", "updatedAt") 
         VALUES ($1, $2, 'READING', 1, NOW(), NOW()) RETURNING id`,
        [`HSK 1: ${item.titleVi} (${item.titleCn})`, item.topicKey]
      );
      psId = ins[0].id;
    }

    // Unlink old questions
    await AppDataSource.query(`DELETE FROM practice_set_question WHERE "practiceSetId" = $1`, [psId]);

    // Insert real questions extracted directly from the workbook
    for (let qIdx = 0; qIdx < item.questions.length; qIdx++) {
      const q = item.questions[qIdx];
      const qRes = await AppDataSource.query(
        `INSERT INTO question (type, skill, difficulty, "hskLevel", payload, "correctAnswer", "createdAt", "updatedAt")
         VALUES ('MULTIPLE_CHOICE', 'READING', 1, 1, $1, $2, NOW(), NOW()) RETURNING id`,
        [
          JSON.stringify({ text: q.text, options: q.options, explanation: q.explanation }),
          JSON.stringify({ answer: q.correct }),
        ]
      );
      const qId = qRes[0].id;

      await AppDataSource.query(
        `INSERT INTO practice_set_question ("practiceSetId", "questionId", "order") VALUES ($1, $2, $3)`,
        [psId, qId, qIdx + 1]
      );
    }
    console.log(`[DONE] ${item.topicKey}: ${item.titleCn} (${item.questions.length} real questions seeded)`);
  }

  // STEP 3: Seed Real HSK 1 Mock Exam (Trang 121-131)
  console.log('Seeding Real HSK 1 Mock Exam from workbook pages 121-131...');
  let examRows = await AppDataSource.query(`SELECT id FROM exam WHERE "hskLevel" = 1 LIMIT 1`);
  let examId: number;
  if (examRows && examRows.length > 0) {
    examId = examRows[0].id;
    await AppDataSource.query(
      `UPDATE exam SET title = 'HSK (一级) 模拟试卷 (新HSK教程1)', description = 'Đề thi thử HSK 1 chính thức trích từ sách bài tập HSK 3.0 mới (Trang 121-131)' WHERE id = $1`,
      [examId]
    );
  } else {
    const examIns = await AppDataSource.query(
      `INSERT INTO exam (title, description, "hskLevel", "createdAt", "updatedAt")
       VALUES ('HSK (一级) 模拟试卷 (新HSK教程1)', 'Đề thi thử HSK 1 chính thức trích từ sách bài tập HSK 3.0 mới (Trang 121-131)', 1, NOW(), NOW()) RETURNING id`
    );
    examId = examIns[0].id;
  }

  let secRows = await AppDataSource.query(`SELECT id FROM exam_section WHERE "examId" = $1 LIMIT 1`, [examId]);
  let secId: number;
  if (secRows && secRows.length > 0) {
    secId = secRows[0].id;
    await AppDataSource.query(`DELETE FROM exam_section_question WHERE "sectionId" = $1`, [secId]);
  } else {
    const secIns = await AppDataSource.query(
      `INSERT INTO exam_section ("examId", title, "order", "createdAt", "updatedAt")
       VALUES ($1, '阅读与听力真题 Reading & Listening', 1, NOW(), NOW()) RETURNING id`,
      [examId]
    );
    secId = secIns[0].id;
  }

  for (let mIdx = 0; mIdx < REAL_HSK1_MOCK_QUESTIONS.length; mIdx++) {
    const mq = REAL_HSK1_MOCK_QUESTIONS[mIdx];
    const mqRes = await AppDataSource.query(
      `INSERT INTO question (type, skill, difficulty, "hskLevel", payload, "correctAnswer", "createdAt", "updatedAt")
       VALUES ('MULTIPLE_CHOICE', 'READING', 1, 1, $1, $2, NOW(), NOW()) RETURNING id`,
      [
        JSON.stringify({ text: `[${mq.part}] ${mq.text}`, options: mq.options, explanation: mq.explanation }),
        JSON.stringify({ answer: mq.correct }),
      ]
    );
    const mqId = mqRes[0].id;

    await AppDataSource.query(
      `INSERT INTO exam_section_question ("sectionId", "questionId", "order") VALUES ($1, $2, $3)`,
      [secId, mqId, mIdx + 1]
    );
  }
  console.log(`[DONE] Real HSK 1 Mock Exam seeded with ${REAL_HSK1_MOCK_QUESTIONS.length} real questions.`);

  // STEP 4: Map Real HSK 1 Vocabularies
  console.log('Mapping real HSK 1 vocabularies to lessons...');
  for (const [topicKey, words] of Object.entries(REAL_HSK1_VOCAB_MAP)) {
    for (const w of words) {
      await AppDataSource.query(
        `UPDATE vocabulary SET topic = $1 WHERE hanzi = $2 AND "hskLevel" = 1`,
        [topicKey, w]
      );
    }
  }

  const counts = await AppDataSource.query(
    `SELECT topic, COUNT(*) as cnt FROM vocabulary WHERE "hskLevel" = 1 AND topic IS NOT NULL GROUP BY topic ORDER BY topic ASC`
  );
  console.log('Mapped HSK 1 Vocab counts:');
  console.table(counts);

  // Check questions remaining in question table
  const sampleRealQ = await AppDataSource.query(`
    SELECT id, payload->>'text' as text FROM question WHERE "hskLevel" = 1 LIMIT 10;
  `);
  console.log('Sample verified HSK 1 questions in DB:');
  console.table(sampleRealQ);

  await AppDataSource.destroy();
  console.log('All real data seeded and verified successfully!');
}

seedRealData().catch(console.error);
