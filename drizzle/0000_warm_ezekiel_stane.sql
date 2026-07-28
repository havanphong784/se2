CREATE TABLE "daily_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_date" date NOT NULL,
	"reviewed_count" integer DEFAULT 0 NOT NULL,
	"learned_count" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"study_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_activity_user_date_unique" UNIQUE("user_id","activity_date"),
	CONSTRAINT "daily_activity_totals_check" CHECK ("daily_activity"."reviewed_count" >= 0 and "daily_activity"."learned_count" >= 0 and "daily_activity"."correct_count" >= 0 and "daily_activity"."xp_earned" >= 0 and "daily_activity"."study_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"level" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decks_slug_unique" UNIQUE("slug"),
	CONSTRAINT "decks_sort_order_check" CHECK ("decks"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"deck_id" uuid,
	"mode" text DEFAULT 'flashcards' NOT NULL,
	"reviewed_count" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_sessions_user_started_unique" UNIQUE("user_id","started_at"),
	CONSTRAINT "study_sessions_counts_check" CHECK ("study_sessions"."reviewed_count" >= 0 and "study_sessions"."correct_count" >= 0 and "study_sessions"."correct_count" <= "study_sessions"."reviewed_count"),
	CONSTRAINT "study_sessions_totals_check" CHECK ("study_sessions"."xp_earned" >= 0 and "study_sessions"."duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"native_language" text DEFAULT 'vi' NOT NULL,
	"target_language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "word_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"word_id" uuid NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"mastery" integer DEFAULT 0 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"incorrect_count" integer DEFAULT 0 NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "word_progress_user_word_unique" UNIQUE("user_id","word_id"),
	CONSTRAINT "word_progress_status_check" CHECK ("word_progress"."status" in ('new', 'learning', 'mastered')),
	CONSTRAINT "word_progress_mastery_check" CHECK ("word_progress"."mastery" between 0 and 100),
	CONSTRAINT "word_progress_interval_check" CHECK ("word_progress"."interval_days" >= 0),
	CONSTRAINT "word_progress_counts_check" CHECK ("word_progress"."correct_count" >= 0 and "word_progress"."incorrect_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"term" text NOT NULL,
	"translation" text NOT NULL,
	"phonetic" text NOT NULL,
	"part_of_speech" text NOT NULL,
	"example_sentence" text NOT NULL,
	"example_translation" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "words_deck_term_unique" UNIQUE("deck_id","term"),
	CONSTRAINT "words_sort_order_check" CHECK ("words"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_progress" ADD CONSTRAINT "word_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_progress" ADD CONSTRAINT "word_progress_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "words" ADD CONSTRAINT "words_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decks_level_sort_order_idx" ON "decks" USING btree ("level","sort_order");--> statement-breakpoint
CREATE INDEX "study_sessions_deck_id_idx" ON "study_sessions" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "word_progress_word_id_idx" ON "word_progress" USING btree ("word_id");--> statement-breakpoint
CREATE INDEX "word_progress_user_review_idx" ON "word_progress" USING btree ("user_id","status","next_review_at");--> statement-breakpoint
CREATE INDEX "words_deck_sort_order_idx" ON "words" USING btree ("deck_id","sort_order");