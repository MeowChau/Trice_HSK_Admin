export interface TextbookLesson {
  topicKey: string;
  hskLevel: number;
  lessonNumber: number;
  titleVi: string;
  titleCn: string;
  pinyin: string;
  icon: string;
}

export const TEXTBOOK_LESSONS: TextbookLesson[] = [
  // HSK 1 (15 Bài học từ sách bài tập Tân HSK 1 - New HSK Course 1 Workbook)
  { topicKey: "HSK1-L01", hskLevel: 1, lessonNumber: 1, titleVi: "Bài 1: Chào bạn, AI Tiểu Ngữ!", titleCn: "AI 小语，你好！", pinyin: "AI Xiǎoyǔ, nǐ hǎo!", icon: "👋" },
  { topicKey: "HSK1-L02", hskLevel: 1, lessonNumber: 2, titleVi: "Bài 2: Tôi tên là Lý Văn", titleCn: "我叫李文", pinyin: "Wǒ jiào Lǐ Wén", icon: "🏷️" },
  { topicKey: "HSK1-L03", hskLevel: 1, lessonNumber: 3, titleVi: "Bài 3: Tôi là người Trung Quốc", titleCn: "我是中国人", pinyin: "Wǒ shì Zhōngguórén", icon: "🇨🇳" },
  { topicKey: "HSK1-L04", hskLevel: 1, lessonNumber: 4, titleVi: "Bài 4: Tôi có hai đứa con", titleCn: "我有两个孩子", pinyin: "Wǒ yǒu liǎng gè háizi", icon: "👨‍👩‍👧‍👦" },
  { topicKey: "HSK1-L05", hskLevel: 1, lessonNumber: 5, titleVi: "Bài 5: Hôm nay tôi được nghỉ", titleCn: "今天我休息", pinyin: "Jīntiān wǒ xiūxi", icon: "🛋️" },
  { topicKey: "HSK1-L06", hskLevel: 1, lessonNumber: 6, titleVi: "Bài 6: Số điện thoại của bạn là bao nhiêu?", titleCn: "你的手机号是多少？", pinyin: "Nǐ de shǒujī hào shì duōshao?", icon: "📱" },
  { topicKey: "HSK1-L07", hskLevel: 1, lessonNumber: 7, titleVi: "Bài 7: Tôi tan làm lúc 6 rưỡi tối", titleCn: "我晚上六点半下班", pinyin: "Wǒ wǎnshang liù diǎn bàn xiàbān", icon: "⏰" },
  { topicKey: "HSK1-L08", hskLevel: 1, lessonNumber: 8, titleVi: "Bài 8: Bố tôi cũng làm việc ở bệnh viện", titleCn: "我爸爸也在医院工作", pinyin: "Wǒ bàba yě zài yīyuàn gōngzuò", icon: "🏥" },
  { topicKey: "HSK1-L09", hskLevel: 1, lessonNumber: 9, titleVi: "Bài 9: Sáng mai tôi học ở trường", titleCn: "我明天上午在学校学习", pinyin: "Wǒ míngtiān shàngwǔ zài xuéxiào xuéxí", icon: "🏫" },
  { topicKey: "HSK1-L10", hskLevel: 1, lessonNumber: 10, titleVi: "Bài 10: Táo ở đây thật là rẻ!", titleCn: "这儿的苹果真便宜！", pinyin: "Zhèr de píngguǒ zhēn piányi!", icon: "🍎" },
  { topicKey: "HSK1-L11", hskLevel: 1, lessonNumber: 11, titleVi: "Bài 11: Tôi đang học đại học", titleCn: "我读大学呢", pinyin: "Wǒ dú dàxué ne", icon: "🎓" },
  { topicKey: "HSK1-L12", hskLevel: 1, lessonNumber: 12, titleVi: "Bài 12: Hôm qua có tuyết rơi", titleCn: "昨天下雪了", pinyin: "Zuótiān xiàxuě le", icon: "❄️" },
  { topicKey: "HSK1-L13", hskLevel: 1, lessonNumber: 13, titleVi: "Bài 13: Xin cho tôi một ly trà", titleCn: "请给我一杯茶", pinyin: "Qǐng gěi wǒ yì bēi chá", icon: "🍵" },
  { topicKey: "HSK1-L14", hskLevel: 1, lessonNumber: 14, titleVi: "Bài 14: Tôi đã xem một bộ phim", titleCn: "我看了一个电影", pinyin: "Wǒ kànle yí gè diànyǐng", icon: "🎬" },
  { topicKey: "HSK1-L15", hskLevel: 1, lessonNumber: 15, titleVi: "Bài 15: Hẹn gặp ở sân bay Đại Hưng!", titleCn: "大兴机场见！", pinyin: "Dàxīng Jīchǎng jiàn!", icon: "🛫" },

  // HSK 2 (15 Bài học)
  { topicKey: "HSK2-L01", hskLevel: 2, lessonNumber: 1, titleVi: "Bài 1: Cô ấy mời chúng tôi ăn vịt quay Bắc Kinh", titleCn: "她请我们吃了北京烤鸭", pinyin: "Tā qǐng wǒmen chīle Běijīng kǎoyā", icon: "🦆" },
  { topicKey: "HSK2-L02", hskLevel: 2, lessonNumber: 2, titleVi: "Bài 2: Hay là đi taxi đến Đại học Bắc Kinh", titleCn: "还是打车去北大吧", pinyin: "Háishì dǎchē qù Běidà ba", icon: "🚕" },
  { topicKey: "HSK2-L03", hskLevel: 2, lessonNumber: 3, titleVi: "Bài 3: Tôi muốn đi du lịch Tây An", titleCn: "我想去西安旅游", pinyin: "Wǒ xiǎng qù Xī'ān lǚyóu", icon: "🚅" },
  { topicKey: "HSK2-L04", hskLevel: 2, lessonNumber: 4, titleVi: "Bài 4: Bạn mặc đồ màu đỏ rất đẹp", titleCn: "你穿红色的很好看", pinyin: "Nǐ chuān hóngsè de hěn hǎokàn", icon: "👗" },
  { topicKey: "HSK2-L05", hskLevel: 2, lessonNumber: 5, titleVi: "Bài 5: Lần đầu tiên đến nhà bạn Trung Quốc", titleCn: "第一次去中国朋友家", pinyin: "Dì-yī cì qù Zhōngguó péngyǒu jiā", icon: "🏡" },
  { topicKey: "HSK2-L06", hskLevel: 2, lessonNumber: 6, titleVi: "Bài 6: Tiểu Tuyết, sinh nhật vui vẻ!", titleCn: "小雪，生日快乐！", pinyin: "Xiǎoxuě, shēngrì kuàilè!", icon: "🎉" },
  { topicKey: "HSK2-L07", hskLevel: 2, lessonNumber: 7, titleVi: "Bài 7: Cậu ấy chơi bóng rổ rất cừ", titleCn: "他篮球打得很好", pinyin: "Tā lánqiú dǎ de hěn hǎo", icon: "🏀" },
  { topicKey: "HSK2-L08", hskLevel: 2, lessonNumber: 8, titleVi: "Bài 8: Mặc dù bạn quên nhưng tôi vẫn nhớ", titleCn: "虽然你忘了，但是我记得", pinyin: "Suīrán nǐ wàng le, dànshì wǒ jìde", icon: "📖" },
  { topicKey: "HSK2-L09", hskLevel: 2, lessonNumber: 9, titleVi: "Bài 9: Tôi đi mua một cốc trà sữa", titleCn: "我去买杯奶茶", pinyin: "Wǒ qù mǎi bēi nǎichá", icon: "🧋" },
  { topicKey: "HSK2-L10", hskLevel: 2, lessonNumber: 10, titleVi: "Bài 10: Sắp phải thi rồi", titleCn: "就要考试了", pinyin: "Jiù yào kǎoshì le", icon: "📝" },
  { topicKey: "HSK2-L11", hskLevel: 2, lessonNumber: 11, titleVi: "Bài 11: Tôi thích ăn món Trung Quốc nhất", titleCn: "我最喜欢吃中国菜", pinyin: "Wǒ zuì xǐhuan chī Zhōngguócài", icon: "🥟" },
  { topicKey: "HSK2-L12", hskLevel: 2, lessonNumber: 12, titleVi: "Bài 12: Nơi này lạnh hơn Bắc Kinh nhiều", titleCn: "这里比北京冷多了", pinyin: "Zhèlǐ bǐ Běijīng lěng duō le", icon: "❄️" },
  { topicKey: "HSK2-L13", hskLevel: 2, lessonNumber: 13, titleVi: "Bài 13: Chúng tôi rất thích tiết học tiếng Trung", titleCn: "我们爱上中文课", pinyin: "Wǒmen ài shàng Zhōngwén kè", icon: "📚" },
  { topicKey: "HSK2-L14", hskLevel: 2, lessonNumber: 14, titleVi: "Bài 14: Đón Tết một mình thật chán", titleCn: "一个人过年多没意思啊", pinyin: "Yí gè rén guònián duō méi yìsi a", icon: "🏮" },
  { topicKey: "HSK2-L15", hskLevel: 2, lessonNumber: 15, titleVi: "Bài 15: Tôi muốn đến Trung Quốc một lần nữa", titleCn: "我想再去一次中国", pinyin: "Wǒ xiǎng zài qù yí cì Zhōngguó", icon: "🌏" },

  // HSK 3 (18 Bài học)
  { topicKey: "HSK3-L01", hskLevel: 3, lessonNumber: 1, titleVi: "Bài 1: Chúng tôi ra sân bay đón các bạn", titleCn: "我们去机场接你们", pinyin: "Wǒmen qù jīchǎng jiē nǐmen", icon: "🛫" },
  { topicKey: "HSK3-L02", hskLevel: 3, lessonNumber: 2, titleVi: "Bài 2: Các bạn muốn ăn gì thì cứ gọi", titleCn: "你们想吃什么就点什么", pinyin: "Nǐmen xiǎng chī shénme jiù diǎn shénme", icon: "🍲" },
  { topicKey: "HSK3-L03", hskLevel: 3, lessonNumber: 3, titleVi: "Bài 3: Khu dân cư này khá tốt", titleCn: "这个小区挺好的", pinyin: "Zhège xiǎoqū tǐng hǎo de", icon: "🏢" },
  { topicKey: "HSK3-L04", hskLevel: 3, lessonNumber: 4, titleVi: "Bài 4: Khách sạn này khác hẳn mọi nơi khác", titleCn: "这家宾馆跟别的都不一样", pinyin: "Zhè jiā bīnguǎn gēn bié de dōu bù yíyàng", icon: "🏨" },
  { topicKey: "HSK3-L05", hskLevel: 3, lessonNumber: 5, titleVi: "Bài 5: Ảnh chụp như thế này mới đẹp", titleCn: "这样的照片才好看", pinyin: "Zhèyàng de zhàopiàn cái hǎokàn", icon: "📸" },
  { topicKey: "HSK3-L06", hskLevel: 3, lessonNumber: 6, titleVi: "Bài 6: Trên tàu cao tốc còn gọi được đồ ăn ngoài", titleCn: "高铁上还可以点外卖", pinyin: "Gāotiě shang hái kěyǐ diǎn wàimài", icon: "🚄" },
  { topicKey: "HSK3-L07", hskLevel: 3, lessonNumber: 7, titleVi: "Bài 7: Chiếc váy đó đẹp hơn chiếc quần đùi", titleCn: "那条裙子比短裤更好看", pinyin: "Nà tiáo qúnzi bǐ duǎnkù gèng hǎokàn", icon: "👗" },
  { topicKey: "HSK3-L08", hskLevel: 3, lessonNumber: 8, titleVi: "Bài 8: Hôm nay tôi đã xuất viện rồi", titleCn: "今天我出院了", pinyin: "Jīntiān wǒ chūyuàn le", icon: "🏥" },
  { topicKey: "HSK3-L09", hskLevel: 3, lessonNumber: 9, titleVi: "Bài 9: Chơi chưa tốt cũng không sao cả", titleCn: "打不好没关系", pinyin: "Dǎ bù hǎo méi guānxi", icon: "🏸" },
  { topicKey: "HSK3-L10", hskLevel: 3, lessonNumber: 10, titleVi: "Bài 10: Ngày mai bạn hẵng trả sách cho tôi", titleCn: "你明天再把书还给我", pinyin: "Nǐ míngtiān zài bǎ shū huán gěi wǒ", icon: "📖" },
  { topicKey: "HSK3-L11", hskLevel: 3, lessonNumber: 11, titleVi: "Bài 11: Xem ra tôi không có cách giải quyết vấn đề này", titleCn: "看来我没办法解决这个问题", pinyin: "Kànlái wǒ méi bànfǎ jiějué zhège wèntí", icon: "🧩" },
  { topicKey: "HSK3-L12", hskLevel: 3, lessonNumber: 12, titleVi: "Bài 12: Mùa này thời tiết thay đổi rất nhanh", titleCn: "这个季节天气变化很快", pinyin: "Zhège jìjié tiānqì biànhuà hěn kuài", icon: "🍂" },
  { topicKey: "HSK3-L13", hskLevel: 3, lessonNumber: 13, titleVi: "Bài 13: Người hàng xóm mới của tôi đến từ nước Anh", titleCn: "我的新邻居来自英国", pinyin: "Wǒ de xīn línjū láizì Yīngguó", icon: "🤝" },
  { topicKey: "HSK3-L14", hskLevel: 3, lessonNumber: 14, titleVi: "Bài 14: Cuốn sách này đã bị người khác mượn mất", titleCn: "这本书被别人借走了", pinyin: "Zhè běn shū bèi biérén jièzǒu le", icon: "📚" },
  { topicKey: "HSK3-L15", hskLevel: 3, lessonNumber: 15, titleVi: "Bài 15: Tôi là nửa người Nam Kinh", titleCn: "我是半个南京人", pinyin: "Wǒ shì bàn gè Nánjīngrén", icon: "🏙️" },
  { topicKey: "HSK3-L16", hskLevel: 3, lessonNumber: 16, titleVi: "Bài 16: Tôi nghe nói có những chú gấu trúc đã đi định cư nước ngoài", titleCn: "我听说有的熊猫出国了", pinyin: "Wǒ tīngshuō yǒude xióngmāo chūguó le", icon: "🐼" },
  { topicKey: "HSK3-L17", hskLevel: 3, lessonNumber: 17, titleVi: "Bài 17: Tôi cần học hỏi nhiều từ những người nghiêm túc", titleCn: "我要多向认真的人学习", pinyin: "Wǒ yào duō xiàng rènzhēn de rén xuéxí", icon: "✍️" },
  { topicKey: "HSK3-L18", hskLevel: 3, lessonNumber: 18, titleVi: "Bài 18: Tôi đã học được cách gói bánh sủi cảo", titleCn: "我学会了包饺子", pinyin: "Wǒ xuéhuì le bāo jiǎozi", icon: "🥟" },
];

export function getLessonsByHsk(hskLevel: number): TextbookLesson[] {
  return TEXTBOOK_LESSONS.filter((l) => l.hskLevel === hskLevel);
}

export function getLessonByTopicKey(topicKey: string): TextbookLesson | undefined {
  return TEXTBOOK_LESSONS.find((l) => l.topicKey === topicKey);
}
