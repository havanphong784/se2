import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    nativeLanguage: text("native_language").default("vi").notNull(),
    targetLanguage: text("target_language").default("en").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique("users_email_unique").on(table.email)],
).enableRLS();

export const decks = pgTable(
  "decks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    level: text("level").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("decks_system_slug_unique")
      .on(table.slug)
      .where(sql`${table.ownerId} is null`),
    uniqueIndex("decks_owner_slug_unique")
      .on(table.ownerId, table.slug)
      .where(sql`${table.ownerId} is not null`),
    index("decks_owner_sort_order_idx").on(table.ownerId, table.sortOrder),
    index("decks_level_sort_order_idx").on(table.level, table.sortOrder),
    check("decks_sort_order_check", sql`${table.sortOrder} >= 0`),
  ],
).enableRLS();

export const words = pgTable(
  "words",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    translation: text("translation").notNull(),
    phonetic: text("phonetic").notNull(),
    partOfSpeech: text("part_of_speech").notNull(),
    exampleSentence: text("example_sentence").notNull(),
    exampleTranslation: text("example_translation").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("words_deck_term_unique").on(table.deckId, table.term),
    index("words_deck_sort_order_idx").on(table.deckId, table.sortOrder),
    check("words_sort_order_check", sql`${table.sortOrder} >= 0`),
  ],
).enableRLS();

export const wordProgress = pgTable(
  "word_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: uuid("word_id")
      .notNull()
      .references(() => words.id, { onDelete: "cascade" }),
    status: text("status").default("new").notNull(),
    mastery: integer("mastery").default(0).notNull(),
    intervalDays: integer("interval_days").default(0).notNull(),
    correctCount: integer("correct_count").default(0).notNull(),
    incorrectCount: integer("incorrect_count").default(0).notNull(),
    learnedAt: timestamp("learned_at", { withTimezone: true }),
    reviewStage: integer("review_stage").default(0).notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    reviewCompletedAt: timestamp("review_completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("word_progress_user_word_unique").on(table.userId, table.wordId),
    index("word_progress_word_id_idx").on(table.wordId),
    index("word_progress_user_review_idx").on(
      table.userId,
      table.status,
      table.nextReviewAt,
    ),
    check(
      "word_progress_status_check",
      sql`${table.status} in ('new', 'learning', 'mastered')`,
    ),
    check(
      "word_progress_mastery_check",
      sql`${table.mastery} between 0 and 100`,
    ),
    check(
      "word_progress_interval_check",
      sql`${table.intervalDays} >= 0`,
    ),
    check(
      "word_progress_review_stage_check",
      sql`${table.reviewStage} between 0 and 3`,
    ),
    check(
      "word_progress_counts_check",
      sql`${table.correctCount} >= 0 and ${table.incorrectCount} >= 0`,
    ),
  ],
).enableRLS();

export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deckId: uuid("deck_id").references(() => decks.id, {
      onDelete: "set null",
    }),
    mode: text("mode").default("learn").notNull(),
    status: text("status").default("active").notNull(),
    phase: text("phase"),
    requestedSize: integer("requested_size"),
    selectedSize: integer("selected_size").default(0).notNull(),
    reviewedCount: integer("reviewed_count").default(0).notNull(),
    learnedCount: integer("learned_count").default(0).notNull(),
    correctCount: integer("correct_count").default(0).notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    incorrectCount: integer("incorrect_count").default(0).notNull(),
    xpEarned: integer("xp_earned").default(0).notNull(),
    durationSeconds: integer("duration_seconds").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    abandonedAt: timestamp("abandoned_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("study_sessions_user_started_unique").on(
      table.userId,
      table.startedAt,
    ),
    index("study_sessions_deck_id_idx").on(table.deckId),
    check(
      "study_sessions_mode_check",
      sql`${table.mode} in ('learn', 'review', 'legacy')`,
    ),
    check(
      "study_sessions_status_check",
      sql`${table.status} in ('active', 'completed', 'abandoned')`,
    ),
    check(
      "study_sessions_phase_check",
      sql`${table.phase} is null or ${table.phase} in ('flashcard', 'multiple_choice', 'typing')`,
    ),
    check(
      "study_sessions_size_check",
      sql`(${table.requestedSize} is null or ${table.requestedSize} in (10, 20)) and ${table.selectedSize} >= 0 and (${table.requestedSize} is null or ${table.selectedSize} <= ${table.requestedSize})`,
    ),
    check(
      "study_sessions_counts_check",
      sql`${table.reviewedCount} >= 0 and ${table.learnedCount} >= 0 and ${table.correctCount} >= 0 and ${table.attemptCount} >= 0 and ${table.incorrectCount} >= 0 and ${table.correctCount} <= ${table.attemptCount} and ${table.incorrectCount} <= ${table.attemptCount}`,
    ),
    check(
      "study_sessions_totals_check",
      sql`${table.xpEarned} >= 0 and ${table.durationSeconds} >= 0`,
    ),
  ],
).enableRLS();

export const studySessionWords = pgTable(
  "study_session_words",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => studySessions.id, { onDelete: "cascade" }),
    wordId: uuid("word_id")
      .notNull()
      .references(() => words.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    flashcardCompletedAt: timestamp("flashcard_completed_at", { withTimezone: true }),
    multipleChoiceCompletedAt: timestamp("multiple_choice_completed_at", {
      withTimezone: true,
    }),
    typingCompletedAt: timestamp("typing_completed_at", { withTimezone: true }),
    correctAttemptCount: integer("correct_attempt_count").default(0).notNull(),
    incorrectAttemptCount: integer("incorrect_attempt_count").default(0).notNull(),
    hadIncorrectAttempt: integer("had_incorrect_attempt").default(0).notNull(),
    lastIncorrectAt: timestamp("last_incorrect_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("study_session_words_session_word_unique").on(table.sessionId, table.wordId),
    unique("study_session_words_session_position_unique").on(table.sessionId, table.position),
    index("study_session_words_session_completed_idx").on(table.sessionId, table.completedAt),
    check("study_session_words_position_check", sql`${table.position} >= 0`),
    check(
      "study_session_words_counts_check",
      sql`${table.correctAttemptCount} >= 0 and ${table.incorrectAttemptCount} >= 0 and ${table.hadIncorrectAttempt} in (0, 1)`,
    ),
  ],
).enableRLS();

export const studyAttempts = pgTable(
  "study_attempts",
  {
    id: uuid("id").primaryKey(),
    sessionWordId: uuid("session_word_id")
      .notNull()
      .references(() => studySessionWords.id, { onDelete: "cascade" }),
    phase: text("phase").notNull(),
    answerNormalized: text("answer_normalized"),
    selectedWordId: uuid("selected_word_id").references(() => words.id, {
      onDelete: "set null",
    }),
    isCorrect: integer("is_correct").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("study_attempts_session_word_time_idx").on(table.sessionWordId, table.attemptedAt),
    check(
      "study_attempts_phase_check",
      sql`${table.phase} in ('flashcard', 'multiple_choice', 'typing')`,
    ),
    check("study_attempts_correct_check", sql`${table.isCorrect} in (0, 1)`),
  ],
).enableRLS();

export const dailyActivity = pgTable(
  "daily_activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityDate: date("activity_date", { mode: "string" }).notNull(),
    reviewedCount: integer("reviewed_count").default(0).notNull(),
    learnedCount: integer("learned_count").default(0).notNull(),
    correctCount: integer("correct_count").default(0).notNull(),
    xpEarned: integer("xp_earned").default(0).notNull(),
    studySeconds: integer("study_seconds").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("daily_activity_user_date_unique").on(
      table.userId,
      table.activityDate,
    ),
    check(
      "daily_activity_totals_check",
      sql`${table.reviewedCount} >= 0 and ${table.learnedCount} >= 0 and ${table.correctCount} >= 0 and ${table.xpEarned} >= 0 and ${table.studySeconds} >= 0`,
    ),
  ],
).enableRLS();
