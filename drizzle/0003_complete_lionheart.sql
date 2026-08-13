CREATE TABLE "study_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_word_id" uuid NOT NULL,
	"phase" text NOT NULL,
	"answer_normalized" text,
	"selected_word_id" uuid,
	"is_correct" integer NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_attempts_phase_check" CHECK ("study_attempts"."phase" in ('flashcard', 'multiple_choice', 'typing')),
	CONSTRAINT "study_attempts_correct_check" CHECK ("study_attempts"."is_correct" in (0, 1))
);
--> statement-breakpoint
ALTER TABLE "study_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "study_session_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"word_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"flashcard_completed_at" timestamp with time zone,
	"multiple_choice_completed_at" timestamp with time zone,
	"typing_completed_at" timestamp with time zone,
	"correct_attempt_count" integer DEFAULT 0 NOT NULL,
	"incorrect_attempt_count" integer DEFAULT 0 NOT NULL,
	"had_incorrect_attempt" integer DEFAULT 0 NOT NULL,
	"last_incorrect_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_session_words_session_word_unique" UNIQUE("session_id","word_id"),
	CONSTRAINT "study_session_words_session_position_unique" UNIQUE("session_id","position"),
	CONSTRAINT "study_session_words_position_check" CHECK ("study_session_words"."position" >= 0),
	CONSTRAINT "study_session_words_counts_check" CHECK ("study_session_words"."correct_attempt_count" >= 0 and "study_session_words"."incorrect_attempt_count" >= 0 and "study_session_words"."had_incorrect_attempt" in (0, 1))
);
--> statement-breakpoint
ALTER TABLE "study_session_words" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "study_sessions" DROP CONSTRAINT "study_sessions_counts_check";--> statement-breakpoint
ALTER TABLE "study_sessions" ALTER COLUMN "mode" SET DEFAULT 'learn';--> statement-breakpoint
UPDATE "study_sessions" SET "mode" = 'legacy';--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "phase" text;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "requested_size" integer;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "selected_size" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "learned_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "incorrect_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "abandoned_at" timestamp with time zone;--> statement-breakpoint
UPDATE "study_sessions" SET "status" = CASE WHEN "completed_at" IS NOT NULL THEN 'completed' ELSE 'abandoned' END, "abandoned_at" = CASE WHEN "completed_at" IS NULL THEN "updated_at" ELSE NULL END;--> statement-breakpoint
ALTER TABLE "word_progress" ADD COLUMN "learned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "word_progress" ADD COLUMN "review_stage" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "word_progress" ADD COLUMN "review_completed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "word_progress" SET "learned_at" = COALESCE("last_reviewed_at", "created_at"), "review_stage" = CASE WHEN "interval_days" >= 30 THEN 2 WHEN "interval_days" >= 7 THEN 1 ELSE 0 END WHERE "status" <> 'new';--> statement-breakpoint
UPDATE "word_progress" SET "status" = 'learning' WHERE "status" = 'mastered';--> statement-breakpoint
ALTER TABLE "study_attempts" ADD CONSTRAINT "study_attempts_session_word_id_study_session_words_id_fk" FOREIGN KEY ("session_word_id") REFERENCES "public"."study_session_words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_attempts" ADD CONSTRAINT "study_attempts_selected_word_id_words_id_fk" FOREIGN KEY ("selected_word_id") REFERENCES "public"."words"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_session_words" ADD CONSTRAINT "study_session_words_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_session_words" ADD CONSTRAINT "study_session_words_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "study_attempts_session_word_time_idx" ON "study_attempts" USING btree ("session_word_id","attempted_at");--> statement-breakpoint
CREATE INDEX "study_session_words_session_completed_idx" ON "study_session_words" USING btree ("session_id","completed_at");--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_mode_check" CHECK ("study_sessions"."mode" in ('learn', 'review', 'legacy'));--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_status_check" CHECK ("study_sessions"."status" in ('active', 'completed', 'abandoned'));--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_phase_check" CHECK ("study_sessions"."phase" is null or "study_sessions"."phase" in ('flashcard', 'multiple_choice', 'typing'));--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_size_check" CHECK (("study_sessions"."requested_size" is null or "study_sessions"."requested_size" in (10, 20)) and "study_sessions"."selected_size" >= 0 and ("study_sessions"."requested_size" is null or "study_sessions"."selected_size" <= "study_sessions"."requested_size"));--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_counts_check" CHECK ("study_sessions"."reviewed_count" >= 0 and "study_sessions"."learned_count" >= 0 and "study_sessions"."correct_count" >= 0 and "study_sessions"."attempt_count" >= 0 and "study_sessions"."incorrect_count" >= 0 and "study_sessions"."correct_count" <= "study_sessions"."attempt_count" and "study_sessions"."incorrect_count" <= "study_sessions"."attempt_count");--> statement-breakpoint
ALTER TABLE "word_progress" ADD CONSTRAINT "word_progress_review_stage_check" CHECK ("word_progress"."review_stage" between 0 and 3);