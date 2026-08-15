import fs from "node:fs";
import path from "node:path";
import { and, eq, isNull, notInArray, or, sql } from "drizzle-orm";

import { closeDb, getDb } from "../src/db";
import {
  dailyActivity,
  decks,
  studySessions,
  users,
  wordProgress,
  words,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/auth-crypto";

import { TOPIC_METADATA, type RawWord } from "../src/lib/topic-metadata";

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function loadVocabularyFiles() {
  const dir = path.join(process.cwd(), "vocabularys");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  files.sort((a, b) => {
    const numA = Number.parseInt(a.match(/topic_(\d+)_/)?.[1] ?? "0", 10);
    const numB = Number.parseInt(b.match(/topic_(\d+)_/)?.[1] ?? "0", 10);
    return numA - numB;
  });

  return files.map((fileName) => {
    const slugKey = fileName.replace(".json", "");
    const rawSlug = slugKey.replace(/^oxford_topic_\d+_/, "");
    const slug = rawSlug.replaceAll("_", "-");
    const fullPath = path.join(dir, fileName);
    const rawContent = fs.readFileSync(fullPath, "utf8");
    const rawWords: RawWord[] = JSON.parse(rawContent);

    const meta = TOPIC_METADATA[rawSlug] ?? {
      title: slug.replaceAll("-", " "),
      description: `Bộ từ vựng chủ đề ${slug}.`,
      level: "A1",
      emoji: "📖",
    };

    return {
      fileName,
      rawSlug,
      slug,
      meta,
      words: rawWords,
    };
  });
}

async function seed() {
  const db = getDb();
  if (!db) {
    throw new Error("DATABASE_URL is required to seed database.");
  }

  const now = new Date();
  const topics = loadVocabularyFiles();

  await db.transaction(async (tx) => {
    const defaultPasswordHash = hashPassword("12345678");

    // 1. Upsert users
    const [demoUser] = await tx
      .insert(users)
      .values({
        email: process.env.DEMO_USER_EMAIL ?? "demo@vocabloom.vn",
        displayName: "Minh Anh",
        passwordHash: defaultPasswordHash,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { displayName: "Minh Anh", passwordHash: defaultPasswordHash, updatedAt: now },
      })
      .returning({ id: users.id });

    await tx
      .insert(users)
      .values({
        email: "havanphong784@gmail.com",
        displayName: "Hà Văn Phong",
        passwordHash: defaultPasswordHash,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { displayName: "Hà Văn Phong", passwordHash: defaultPasswordHash, updatedAt: now },
      });

    const seededDecks: { id: string; slug: string }[] = [];
    const seededWords: { id: string; deckId: string }[] = [];

    // 2. Clean up any decks owned by demoUser or legacy unowned decks not in standard 36 topics
    const validSlugs = topics.map((t) => t.slug);
    await tx
      .delete(decks)
      .where(
        or(
          eq(decks.ownerId, demoUser.id),
          and(isNull(decks.ownerId), notInArray(decks.slug, validSlugs)),
        ),
      );
    for (const [deckIndex, topic] of topics.entries()) {
      const [deck] = await tx
        .insert(decks)
        .values({
          ownerId: null,
          slug: topic.slug,
          title: topic.meta.title,
          description: topic.meta.description,
          level: topic.meta.level,
          sortOrder: deckIndex,
        })
        .onConflictDoUpdate({
          target: decks.slug,
          targetWhere: sql`${decks.ownerId} is null`,
          set: {
            title: topic.meta.title,
            description: topic.meta.description,
            level: topic.meta.level,
            sortOrder: deckIndex,
            updatedAt: now,
          },
        })
        .returning({ id: decks.id, slug: decks.slug });

      seededDecks.push(deck);

      for (const [wordIndex, item] of topic.words.entries()) {
        const [word] = await tx
          .insert(words)
          .values({
            deckId: deck.id,
            term: item.term,
            translation: item.translation,
            phonetic: item.phonetic,
            partOfSpeech: item.partOfSpeech ?? [],
            exampleSentence: item.exampleSentence,
            exampleTranslation: item.exampleTranslation,
            sortOrder: wordIndex,
          })
          .onConflictDoUpdate({
            target: [words.deckId, words.term],
            set: {
              translation: item.translation,
              phonetic: item.phonetic,
              partOfSpeech: item.partOfSpeech ?? [],
              exampleSentence: item.exampleSentence,
              exampleTranslation: item.exampleTranslation,
              sortOrder: wordIndex,
              updatedAt: now,
            },
          })
          .returning({ id: words.id, deckId: words.deckId });

        seededWords.push(word);
      }
    }

    // 3. Seed demo user progress for first 15 words
    for (const [index, wordItem] of seededWords.slice(0, 15).entries()) {
      const mastery = Math.min(100, 25 + index * 5);
      const lastReviewedAt = dateDaysAgo(index % 5);
      const nextReviewAt = dateDaysAgo(-(1 + (index % 4)));

      await tx
        .insert(wordProgress)
        .values({
          userId: demoUser.id,
          wordId: wordItem.id,
          status: "learning",
          mastery,
          intervalDays: index % 3 === 0 ? 30 : index % 3 === 1 ? 7 : 3,
          learnedAt: dateDaysAgo(40 + index),
          reviewStage: (index % 3) as 0 | 1 | 2,
          correctCount: 2 + index,
          incorrectCount: index % 3,
          lastReviewedAt,
          nextReviewAt,
          reviewCompletedAt: null,
        })
        .onConflictDoUpdate({
          target: [wordProgress.userId, wordProgress.wordId],
          set: {
            status: "learning",
            mastery,
            intervalDays: index % 3 === 0 ? 30 : index % 3 === 1 ? 7 : 3,
            learnedAt: dateDaysAgo(40 + index),
            reviewStage: (index % 3) as 0 | 1 | 2,
            correctCount: 2 + index,
            incorrectCount: index % 3,
            lastReviewedAt,
            nextReviewAt,
            reviewCompletedAt: null,
            updatedAt: now,
          },
        });
    }

    // 4. Seed demo study sessions
    const sessionStats = [
      { daysAgo: 6, reviewed: 6, correct: 4, seconds: 420, xp: 40 },
      { daysAgo: 4, reviewed: 8, correct: 6, seconds: 540, xp: 60 },
      { daysAgo: 2, reviewed: 10, correct: 8, seconds: 660, xp: 80 },
      { daysAgo: 0, reviewed: 12, correct: 10, seconds: 720, xp: 100 },
    ];

    for (const [index, session] of sessionStats.entries()) {
      const startedAt = dateDaysAgo(session.daysAgo);
      startedAt.setUTCHours(12, 0, 0, 0);
      const completedAt = new Date(startedAt.getTime() + session.seconds * 1000);

      await tx
        .insert(studySessions)
        .values({
          userId: demoUser.id,
          deckId: seededDecks[index].id,
          mode: "legacy",
          status: "completed",
          reviewedCount: session.reviewed,
          correctCount: session.correct,
          attemptCount: session.reviewed,
          incorrectCount: session.reviewed - session.correct,
          xpEarned: session.xp,
          durationSeconds: session.seconds,
          startedAt,
          lastActivityAt: completedAt,
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

    // 5. Seed demo daily activity
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
    `Successfully seeded ${topics.length} system default decks with ${topics.reduce((acc, t) => acc + t.words.length, 0)} total words.`,
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
