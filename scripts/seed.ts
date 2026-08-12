import { closeDb, getDb } from "../src/db";
import {
  dailyActivity,
  decks,
  studySessions,
  users,
  wordProgress,
  words,
} from "../src/db/schema";

const deckSeeds = [
  {
    slug: "giao-tiep-hang-ngay",
    title: "Giao tiếp hằng ngày",
    description: "Những từ đầu tiên để chào hỏi và trò chuyện lịch sự.",
    level: "A1",
    words: [
      ["hello", "xin chào", "/həˈləʊ/", "thán từ", "Hello, nice to meet you.", "Xin chào, rất vui được gặp bạn."],
      ["goodbye", "tạm biệt", "/ˌɡʊdˈbaɪ/", "thán từ", "Goodbye, see you tomorrow.", "Tạm biệt, hẹn gặp bạn ngày mai."],
      ["please", "làm ơn", "/pliːz/", "thán từ", "Please open the window.", "Làm ơn mở cửa sổ."],
      ["thank you", "cảm ơn", "/ˈθæŋk juː/", "cụm từ", "Thank you for your help.", "Cảm ơn bạn đã giúp đỡ."],
      ["sorry", "xin lỗi", "/ˈsɒr.i/", "tính từ", "I am sorry I am late.", "Tôi xin lỗi vì đã đến muộn."],
      ["welcome", "chào mừng", "/ˈwel.kəm/", "thán từ", "Welcome to our class.", "Chào mừng bạn đến với lớp học."],
    ],
  },
  {
    slug: "gia-dinh-va-ban-be",
    title: "Gia đình & bạn bè",
    description: "Gọi tên những người thân quen xung quanh bạn.",
    level: "A1",
    words: [
      ["family", "gia đình", "/ˈfæm.əl.i/", "danh từ", "My family lives in Da Nang.", "Gia đình tôi sống ở Đà Nẵng."],
      ["mother", "mẹ", "/ˈmʌð.ər/", "danh từ", "My mother loves gardening.", "Mẹ tôi thích làm vườn."],
      ["father", "bố", "/ˈfɑː.ðər/", "danh từ", "Her father is a teacher.", "Bố cô ấy là giáo viên."],
      ["sister", "chị/em gái", "/ˈsɪs.tər/", "danh từ", "My sister studies English.", "Chị gái tôi học tiếng Anh."],
      ["brother", "anh/em trai", "/ˈbrʌð.ər/", "danh từ", "His brother plays football.", "Em trai anh ấy chơi bóng đá."],
      ["friend", "bạn bè", "/frend/", "danh từ", "Lan is my best friend.", "Lan là bạn thân nhất của tôi."],
    ],
  },
  {
    slug: "do-an-va-thuc-uong",
    title: "Đồ ăn & thức uống",
    description: "Từ vựng quen thuộc cho bữa ăn và lúc gọi món.",
    level: "A1",
    words: [
      ["water", "nước", "/ˈwɔː.tər/", "danh từ", "Can I have some water?", "Tôi có thể xin một ít nước không?"],
      ["rice", "cơm/gạo", "/raɪs/", "danh từ", "We eat rice every day.", "Chúng tôi ăn cơm mỗi ngày."],
      ["bread", "bánh mì", "/bred/", "danh từ", "This bread is still warm.", "Ổ bánh mì này vẫn còn ấm."],
      ["coffee", "cà phê", "/ˈkɒf.i/", "danh từ", "She drinks coffee in the morning.", "Cô ấy uống cà phê vào buổi sáng."],
      ["apple", "quả táo", "/ˈæp.əl/", "danh từ", "I put an apple in my bag.", "Tôi để một quả táo vào túi."],
      ["delicious", "ngon", "/dɪˈlɪʃ.əs/", "tính từ", "The soup is delicious.", "Món súp rất ngon."],
    ],
  },
  {
    slug: "du-lich-co-ban",
    title: "Du lịch cơ bản",
    description: "Các từ thiết yếu cho một chuyến đi tự tin hơn.",
    level: "A2",
    words: [
      ["airport", "sân bay", "/ˈeə.pɔːt/", "danh từ", "We arrived at the airport early.", "Chúng tôi đến sân bay sớm."],
      ["hotel", "khách sạn", "/həʊˈtel/", "danh từ", "Our hotel is near the beach.", "Khách sạn của chúng tôi gần bãi biển."],
      ["ticket", "vé", "/ˈtɪk.ɪt/", "danh từ", "I bought a train ticket.", "Tôi đã mua một vé tàu."],
      ["passport", "hộ chiếu", "/ˈpɑːs.pɔːt/", "danh từ", "Please show me your passport.", "Vui lòng cho tôi xem hộ chiếu của bạn."],
      ["train", "tàu hỏa", "/treɪn/", "danh từ", "The train leaves at nine.", "Tàu khởi hành lúc chín giờ."],
      ["direction", "phương hướng/chỉ đường", "/dɪˈrek.ʃən/", "danh từ", "Could you give me directions?", "Bạn có thể chỉ đường cho tôi không?"],
    ],
  },
] as const;

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function seed() {
  const db = getDb();

  if (!db) {
    throw new Error("DATABASE_URL is required to seed the database.");
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    const [demoUser] = await tx
      .insert(users)
      .values({
        email: process.env.DEMO_USER_EMAIL ?? "demo@vocabloom.vn",
        displayName: "Minh Anh",
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { displayName: "Minh Anh", updatedAt: now },
      })
      .returning({ id: users.id });

    const seededDecks: { id: string; slug: string }[] = [];
    const seededWords: { id: string; deckId: string }[] = [];

    for (const [deckIndex, deckSeed] of deckSeeds.entries()) {
      const [deck] = await tx
        .insert(decks)
        .values({
          slug: deckSeed.slug,
          title: deckSeed.title,
          description: deckSeed.description,
          level: deckSeed.level,
          sortOrder: deckIndex,
        })
        .onConflictDoUpdate({
          target: decks.slug,
          set: {
            title: deckSeed.title,
            description: deckSeed.description,
            level: deckSeed.level,
            sortOrder: deckIndex,
            updatedAt: now,
          },
        })
        .returning({ id: decks.id, slug: decks.slug });

      seededDecks.push(deck);

      for (const [wordIndex, wordSeed] of deckSeed.words.entries()) {
        const [term, translation, phonetic, partOfSpeech, exampleSentence, exampleTranslation] =
          wordSeed;
        const [word] = await tx
          .insert(words)
          .values({
            deckId: deck.id,
            term,
            translation,
            phonetic,
            partOfSpeech,
            exampleSentence,
            exampleTranslation,
            sortOrder: wordIndex,
          })
          .onConflictDoUpdate({
            target: [words.deckId, words.term],
            set: {
              translation,
              phonetic,
              partOfSpeech,
              exampleSentence,
              exampleTranslation,
              sortOrder: wordIndex,
              updatedAt: now,
            },
          })
          .returning({ id: words.id, deckId: words.deckId });

        seededWords.push(word);
      }
    }

    for (const [index, word] of seededWords.slice(0, 12).entries()) {
      const mastery = Math.min(100, 25 + index * 7);
      const lastReviewedAt = dateDaysAgo(index % 5);
      const nextReviewAt = dateDaysAgo(-(1 + (index % 4)));

      await tx
        .insert(wordProgress)
        .values({
          userId: demoUser.id,
          wordId: word.id,
          status: mastery >= 80 ? "mastered" : "learning",
          mastery,
          intervalDays: mastery >= 80 ? 5 : mastery >= 50 ? 2 : 1,
          correctCount: 2 + index,
          incorrectCount: index % 3,
          lastReviewedAt,
          nextReviewAt,
        })
        .onConflictDoUpdate({
          target: [wordProgress.userId, wordProgress.wordId],
          set: {
            status: mastery >= 80 ? "mastered" : "learning",
            mastery,
            intervalDays: mastery >= 80 ? 5 : mastery >= 50 ? 2 : 1,
            correctCount: 2 + index,
            incorrectCount: index % 3,
            lastReviewedAt,
            nextReviewAt,
            updatedAt: now,
          },
        });
    }

    const sessionStats = [
      { daysAgo: 6, reviewed: 6, correct: 4, seconds: 420, xp: 40 },
      { daysAgo: 4, reviewed: 8, correct: 6, seconds: 540, xp: 60 },
      { daysAgo: 2, reviewed: 10, correct: 8, seconds: 660, xp: 80 },
      { daysAgo: 0, reviewed: 12, correct: 10, seconds: 720, xp: 100 },
    ];

    for (const [index, session] of sessionStats.entries()) {
      const startedAt = dateDaysAgo(session.daysAgo);
      startedAt.setUTCHours(12, 0, 0, 0);
      const completedAt = new Date(
        startedAt.getTime() + session.seconds * 1_000,
      );

      await tx
        .insert(studySessions)
        .values({
          userId: demoUser.id,
          deckId: seededDecks[index].id,
          reviewedCount: session.reviewed,
          correctCount: session.correct,
          xpEarned: session.xp,
          durationSeconds: session.seconds,
          startedAt,
          completedAt,
        })
        .onConflictDoUpdate({
          target: [studySessions.userId, studySessions.startedAt],
          set: {
            deckId: seededDecks[index].id,
            reviewedCount: session.reviewed,
            correctCount: session.correct,
            xpEarned: session.xp,
            durationSeconds: session.seconds,
            completedAt,
            updatedAt: now,
          },
        });
    }

    const dailyStats = [
      [6, 6, 3, 4, 40, 420],
      [5, 4, 2, 3, 30, 300],
      [4, 8, 4, 6, 60, 540],
      [3, 5, 2, 4, 40, 360],
      [2, 10, 5, 8, 80, 660],
      [1, 7, 3, 6, 60, 480],
      [0, 12, 6, 10, 100, 720],
    ] as const;

    for (const [daysAgo, reviewed, learned, correct, xp, seconds] of dailyStats) {
      const activityDate = dateKey(dateDaysAgo(daysAgo));

      await tx
        .insert(dailyActivity)
        .values({
          userId: demoUser.id,
          activityDate,
          reviewedCount: reviewed,
          learnedCount: learned,
          correctCount: correct,
          xpEarned: xp,
          studySeconds: seconds,
        })
        .onConflictDoUpdate({
          target: [dailyActivity.userId, dailyActivity.activityDate],
          set: {
            reviewedCount: reviewed,
            learnedCount: learned,
            correctCount: correct,
            xpEarned: xp,
            studySeconds: seconds,
            updatedAt: now,
          },
        });
    }
  });

  console.log(
    `Seeded ${deckSeeds.length} decks and ${deckSeeds.reduce((total, deck) => total + deck.words.length, 0)} words for demo@vocabloom.vn.`,
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
