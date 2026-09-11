CREATE TABLE "reading_annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sentence_hash" text NOT NULL,
	"analysis_json" text NOT NULL,
	"saved_word_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading_annotations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reading_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source_type" text NOT NULL,
	"original_file_name" text,
	"raw_content" text NOT NULL,
	"total_words" integer DEFAULT 0 NOT NULL,
	"estimated_cefr" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD COLUMN "otp_hash" text;--> statement-breakpoint
ALTER TABLE "reading_annotations" ADD CONSTRAINT "reading_annotations_document_id_reading_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."reading_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_annotations" ADD CONSTRAINT "reading_annotations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_annotations" ADD CONSTRAINT "reading_annotations_saved_word_id_words_id_fk" FOREIGN KEY ("saved_word_id") REFERENCES "public"."words"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_documents" ADD CONSTRAINT "reading_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reading_annotations_doc_user_idx" ON "reading_annotations" USING btree ("document_id","user_id");--> statement-breakpoint
CREATE INDEX "reading_annotations_hash_idx" ON "reading_annotations" USING btree ("sentence_hash");--> statement-breakpoint
CREATE INDEX "reading_documents_user_id_idx" ON "reading_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_otp_idx" ON "email_verification_tokens" USING btree ("user_id","otp_hash");