export type RawWord = {
  term: string;
  translation: string;
  phonetic: string;
  partOfSpeech: string[];
  exampleSentence: string;
  exampleTranslation: string;
};

export type TopicMeta = {
  title: string;
  description: string;
  level: string;
  emoji: string;
};

export const TOPIC_METADATA: Record<string, TopicMeta> = {
  school_supplies: {
    title: "Dụng cụ học tập",
    description: "Từ vựng về các đồ dùng học tập phổ biến trong lớp học.",
    level: "A1",
    emoji: "✏️",
  },
  actions: {
    title: "Hành động thường ngày",
    description: "Các động từ chỉ hoạt động cơ bản hằng ngày.",
    level: "A1",
    emoji: "🏃",
  },
  bedroom: {
    title: "Phòng ngủ",
    description: "Từ vựng về các vật dụng và không gian trong phòng ngủ.",
    level: "A1",
    emoji: "🛏️",
  },
  shopping: {
    title: "Mua sắm & Hàng hóa",
    description: "Các từ vựng giao tiếp khi đi mua sắm và siêu thị.",
    level: "A2",
    emoji: "🛍️",
  },
  living_room: {
    title: "Phòng khách",
    description: "Đồ nội thất và vật dụng trang trí phòng khách.",
    level: "A1",
    emoji: "🛋️",
  },
  routines: {
    title: "Thói quen hằng ngày",
    description: "Mô tả nhịp sống và thói quen sinh hoạt mỗi ngày.",
    level: "A1",
    emoji: "⏰",
  },
  friendship: {
    title: "Tình bạn & Mối quan hệ",
    description: "Từ vựng tình cảm, sự gắn kết và giao tiếp bạn bè.",
    level: "A2",
    emoji: "🤝",
  },
  jewelry: {
    title: "Trang sức & Phụ kiện",
    description: "Tên gọi các loại phụ kiện và đồ trang sức.",
    level: "A2",
    emoji: "💎",
  },
  kitchen: {
    title: "Nhà bếp & Dụng cụ nấu ăn",
    description: "Từ vựng về thiết bị, dụng cụ và không gian nhà bếp.",
    level: "A1",
    emoji: "🍳",
  },
  hospital: {
    title: "Bệnh viện & Y tế",
    description: "Từ vựng quan trọng khi thăm khám và chăm sóc sức khỏe.",
    level: "B1",
    emoji: "🏥",
  },
  computer: {
    title: "Máy tính & Công nghệ",
    description: "Thiết bị tin học, internet và công nghệ thông tin.",
    level: "A2",
    emoji: "💻",
  },
  mid_autumn: {
    title: "Tết Trung thu",
    description: "Từ vựng về văn hóa, bánh trái và lễ hội Trung thu.",
    level: "A2",
    emoji: "🥮",
  },
  health: {
    title: "Sức khỏe & Cơ thể",
    description: "Từ vựng về thể chất, triệu chứng và lối sống lành mạnh.",
    level: "A2",
    emoji: "🩺",
  },
  sports: {
    title: "Thể thao & Rèn luyện",
    description: "Các môn thể thao và hoạt động vận động thể chất.",
    level: "A1",
    emoji: "⚽",
  },
  football: {
    title: "Bóng đá",
    description: "Thuật ngữ chuyên sâu và vị trí thi đấu bóng đá.",
    level: "A2",
    emoji: "🥅",
  },
  christmas: {
    title: "Giáng sinh & Lễ hội",
    description: "Từ vựng trang trí, không khí và quà tặng Giáng sinh.",
    level: "A1",
    emoji: "🎄",
  },
  household_chores: {
    title: "Việc nhà & Chăm sóc nhà cửa",
    description: "Các công việc dọn dẹp và nội trợ hằng ngày.",
    level: "A1",
    emoji: "🧹",
  },
  shops: {
    title: "Cửa hàng & Dịch vụ",
    description: "Các loại hình cửa hàng và địa điểm dịch vụ.",
    level: "A2",
    emoji: "🏪",
  },
  travel: {
    title: "Du lịch & Khám phá",
    description: "Hành trình, điểm đến và trải nghiệm du lịch.",
    level: "A2",
    emoji: "✈️",
  },
  airport: {
    title: "Sân bay & Thẻ đi máy bay",
    description: "Thủ tục hàng không, bay và hành lý tại sân bay.",
    level: "A2",
    emoji: "🛫",
  },
  time: {
    title: "Thời gian & Thời điểm",
    description: "Từ vựng đo lường và diễn tả thời gian.",
    level: "A1",
    emoji: "⏳",
  },
  hometown: {
    title: "Quê hương & Đô thị",
    description: "Mô tả phong cảnh, nơi chốn và cuộc sống quê hương.",
    level: "A2",
    emoji: "🏡",
  },
  traffic: {
    title: "Giao thông & Phương tiện",
    description: "Phương tiện di chuyển và luật lệ giao thông đường bộ.",
    level: "A2",
    emoji: "🚦",
  },
  flowers: {
    title: "Các loại hoa",
    description: "Tên gọi và đặc điểm các loài hoa phổ biến.",
    level: "A2",
    emoji: "🌸",
  },
  personality: {
    title: "Tính cách & Phẩm chất",
    description: "Tính từ mô tả tính cách và thái độ con người.",
    level: "B1",
    emoji: "🌟",
  },
  drinks: {
    title: "Đồ uống & Giải khát",
    description: "Các loại thức uống phổ biến hằng ngày.",
    level: "A1",
    emoji: "🥤",
  },
  movies: {
    title: "Phim ảnh & Điện ảnh",
    description: "Thể loại phim, rạp chiếu và thuật ngữ điện ảnh.",
    level: "A2",
    emoji: "🎬",
  },
  food: {
    title: "Ẩm thực & Món ăn",
    description: "Từ vựng phong phú về các món ăn và nguyên liệu.",
    level: "A1",
    emoji: "🍲",
  },
  sea: {
    title: "Biển & Sinh vật biển",
    description: "Đại dương, bãi biển và các loài sinh vật biển.",
    level: "A2",
    emoji: "🌊",
  },
  wedding: {
    title: "Lễ cưới & Tiệc cưới",
    description: "Từ vựng trang trọng về nghi lễ và tiệc cưới.",
    level: "B1",
    emoji: "💍",
  },
  music: {
    title: "Âm nhạc & Nhạc cụ",
    description: "Giai điệu, thể loại nhạc và các loại nhạc cụ.",
    level: "A2",
    emoji: "🎵",
  },
  emotions: {
    title: "Cảm xúc & Tâm trạng",
    description: "Bày tỏ trạng thái cảm xúc và tâm lý con người.",
    level: "A2",
    emoji: "😊",
  },
  environment: {
    title: "Môi trường & Tự nhiên",
    description: "Bảo vệ thiên nhiên, sinh thái và biến đổi khí hậu.",
    level: "B1",
    emoji: "🌱",
  },
  entertainment: {
    title: "Giải trí & Sự kiện",
    description: "Các hoạt động vui chơi và sự kiện giải trí.",
    level: "A2",
    emoji: "🎟️",
  },
  vegetables: {
    title: "Rau củ quả",
    description: "Tên các loại rau củ tươi ngon trong bữa ăn.",
    level: "A1",
    emoji: "🥦",
  },
  numbers: {
    title: "Con số & Phép tính",
    description: "Chữ số, số thứ tự và các thuật ngữ toán học cơ bản.",
    level: "A1",
    emoji: "🔢",
  },
};
