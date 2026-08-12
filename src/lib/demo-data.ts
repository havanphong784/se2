export type WordStatus = "new" | "learning" | "mastered";

export type VocabularyWord = {
  id: string;
  term: string;
  translation: string;
  phonetic: string;
  partOfSpeech: string;
  exampleSentence: string;
  exampleTranslation: string;
  status: WordStatus;
  mastery: number;
  intervalDays: number;
  nextReviewAt: string | null;
};

export type VocabularyDeck = {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  emoji: string;
  ownership?: "system" | "personal";
  words: VocabularyWord[];
};

export type DailyActivity = {
  day: string;
  fullDate: string;
  reviewed: number;
  learned: number;
  xp: number;
};

const word = (
  deck: string,
  term: string,
  translation: string,
  phonetic: string,
  partOfSpeech: string,
  exampleSentence: string,
  exampleTranslation: string,
  status: WordStatus = "new",
  mastery = 0,
  intervalDays = 0,
): VocabularyWord => ({
  id: `${deck}-${term.replaceAll(" ", "-")}`,
  term,
  translation,
  phonetic,
  partOfSpeech,
  exampleSentence,
  exampleTranslation,
  status,
  mastery,
  intervalDays,
  nextReviewAt: status === "new" ? null : new Date(0).toISOString(),
});

export const DEMO_DECKS: VocabularyDeck[] = [
  {
    id: "deck-giao-tiep",
    slug: "giao-tiep-hang-ngay",
    title: "Giao tiếp hằng ngày",
    description: "Chào hỏi và trò chuyện tự nhiên trong những tình huống quen thuộc.",
    level: "A1",
    emoji: "👋",
    words: [
      word(
        "giao-tiep",
        "hello",
        "xin chào",
        "/həˈləʊ/",
        "thán từ",
        "Hello, nice to meet you.",
        "Xin chào, rất vui được gặp bạn.",
        "mastered",
        100,
        12,
      ),
      word(
        "giao-tiep",
        "goodbye",
        "tạm biệt",
        "/ˌɡʊdˈbaɪ/",
        "thán từ",
        "Goodbye, see you tomorrow.",
        "Tạm biệt, hẹn gặp bạn ngày mai.",
        "mastered",
        92,
        8,
      ),
      word(
        "giao-tiep",
        "please",
        "làm ơn",
        "/pliːz/",
        "thán từ",
        "Please open the window.",
        "Làm ơn mở cửa sổ.",
        "learning",
        68,
        3,
      ),
      word(
        "giao-tiep",
        "thank you",
        "cảm ơn",
        "/ˈθæŋk juː/",
        "cụm từ",
        "Thank you for your help.",
        "Cảm ơn bạn đã giúp đỡ.",
        "mastered",
        88,
        7,
      ),
      word(
        "giao-tiep",
        "sorry",
        "xin lỗi",
        "/ˈsɒr.i/",
        "tính từ",
        "I am sorry I am late.",
        "Tôi xin lỗi vì đã đến muộn.",
        "learning",
        45,
        1,
      ),
      word(
        "giao-tiep",
        "welcome",
        "chào mừng",
        "/ˈwel.kəm/",
        "thán từ",
        "Welcome to our class.",
        "Chào mừng bạn đến với lớp học.",
        "mastered",
        82,
        5,
      ),
    ],
  },
  {
    id: "deck-gia-dinh",
    slug: "gia-dinh-va-ban-be",
    title: "Gia đình & bạn bè",
    description: "Mô tả những người thân quen và các mối quan hệ xung quanh bạn.",
    level: "A1",
    emoji: "🏡",
    words: [
      word(
        "gia-dinh",
        "family",
        "gia đình",
        "/ˈfæm.əl.i/",
        "danh từ",
        "My family lives in Da Nang.",
        "Gia đình tôi sống ở Đà Nẵng.",
        "mastered",
        84,
        5,
      ),
      word(
        "gia-dinh",
        "mother",
        "mẹ",
        "/ˈmʌð.ər/",
        "danh từ",
        "My mother loves gardening.",
        "Mẹ tôi thích làm vườn.",
        "learning",
        62,
        2,
      ),
      word(
        "gia-dinh",
        "father",
        "bố",
        "/ˈfɑː.ðər/",
        "danh từ",
        "Her father is a teacher.",
        "Bố cô ấy là giáo viên.",
        "learning",
        50,
        1,
      ),
      word(
        "gia-dinh",
        "sister",
        "chị/em gái",
        "/ˈsɪs.tər/",
        "danh từ",
        "My sister studies English.",
        "Chị gái tôi học tiếng Anh.",
        "learning",
        35,
        1,
      ),
      word(
        "gia-dinh",
        "brother",
        "anh/em trai",
        "/ˈbrʌð.ər/",
        "danh từ",
        "His brother plays football.",
        "Em trai anh ấy chơi bóng đá.",
      ),
      word(
        "gia-dinh",
        "friend",
        "bạn bè",
        "/frend/",
        "danh từ",
        "Lan is my best friend.",
        "Lan là bạn thân nhất của tôi.",
      ),
    ],
  },
  {
    id: "deck-do-an",
    slug: "do-an-va-thuc-uong",
    title: "Đồ ăn & thức uống",
    description: "Từ vựng thiết yếu cho bữa ăn, đi chợ và gọi món ở nhà hàng.",
    level: "A1",
    emoji: "🥗",
    words: [
      word(
        "do-an",
        "water",
        "nước",
        "/ˈwɔː.tər/",
        "danh từ",
        "Can I have some water?",
        "Tôi có thể xin một ít nước không?",
        "learning",
        42,
        1,
      ),
      word(
        "do-an",
        "rice",
        "cơm/gạo",
        "/raɪs/",
        "danh từ",
        "We eat rice every day.",
        "Chúng tôi ăn cơm mỗi ngày.",
        "learning",
        30,
        1,
      ),
      word(
        "do-an",
        "bread",
        "bánh mì",
        "/bred/",
        "danh từ",
        "This bread is still warm.",
        "Ổ bánh mì này vẫn còn ấm.",
      ),
      word(
        "do-an",
        "coffee",
        "cà phê",
        "/ˈkɒf.i/",
        "danh từ",
        "She drinks coffee in the morning.",
        "Cô ấy uống cà phê vào buổi sáng.",
      ),
      word(
        "do-an",
        "apple",
        "quả táo",
        "/ˈæp.əl/",
        "danh từ",
        "I put an apple in my bag.",
        "Tôi để một quả táo vào túi.",
      ),
      word(
        "do-an",
        "delicious",
        "ngon",
        "/dɪˈlɪʃ.əs/",
        "tính từ",
        "The soup is delicious.",
        "Món súp rất ngon.",
      ),
    ],
  },
  {
    id: "deck-du-lich",
    slug: "du-lich-co-ban",
    title: "Du lịch cơ bản",
    description: "Di chuyển, đặt phòng và hỏi đường tự tin hơn trong chuyến đi.",
    level: "A2",
    emoji: "🧳",
    words: [
      word(
        "du-lich",
        "airport",
        "sân bay",
        "/ˈeə.pɔːt/",
        "danh từ",
        "We arrived at the airport early.",
        "Chúng tôi đến sân bay sớm.",
        "learning",
        24,
        1,
      ),
      word(
        "du-lich",
        "hotel",
        "khách sạn",
        "/həʊˈtel/",
        "danh từ",
        "Our hotel is near the beach.",
        "Khách sạn của chúng tôi gần bãi biển.",
      ),
      word(
        "du-lich",
        "ticket",
        "vé",
        "/ˈtɪk.ɪt/",
        "danh từ",
        "I bought a train ticket.",
        "Tôi đã mua một vé tàu.",
      ),
      word(
        "du-lich",
        "passport",
        "hộ chiếu",
        "/ˈpɑːs.pɔːt/",
        "danh từ",
        "Please show me your passport.",
        "Vui lòng cho tôi xem hộ chiếu của bạn.",
      ),
      word(
        "du-lich",
        "train",
        "tàu hỏa",
        "/treɪn/",
        "danh từ",
        "The train leaves at nine.",
        "Tàu khởi hành lúc chín giờ.",
      ),
      word(
        "du-lich",
        "direction",
        "phương hướng",
        "/dɪˈrek.ʃən/",
        "danh từ",
        "Could you give me directions?",
        "Bạn có thể chỉ đường cho tôi không?",
      ),
    ],
  },
];

export const DEMO_ACTIVITY: DailyActivity[] = [
  { day: "T2", fullDate: "06/07", reviewed: 8, learned: 4, xp: 55 },
  { day: "T3", fullDate: "07/07", reviewed: 12, learned: 6, xp: 85 },
  { day: "T4", fullDate: "08/07", reviewed: 7, learned: 3, xp: 45 },
  { day: "T5", fullDate: "09/07", reviewed: 15, learned: 8, xp: 110 },
  { day: "T6", fullDate: "10/07", reviewed: 10, learned: 5, xp: 75 },
  { day: "T7", fullDate: "11/07", reviewed: 18, learned: 9, xp: 130 },
  { day: "CN", fullDate: "12/07", reviewed: 6, learned: 3, xp: 40 },
];

export function deckProgress(deck: VocabularyDeck) {
  const mastered = deck.words.filter((item) => item.status === "mastered").length;
  const learning = deck.words.filter((item) => item.status === "learning").length;
  const completed = mastered + learning * 0.5;

  return {
    mastered,
    learning,
    fresh: deck.words.length - mastered - learning,
    percent: deck.words.length === 0 ? 0 : Math.round((completed / deck.words.length) * 100),
  };
}
