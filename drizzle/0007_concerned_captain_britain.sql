CREATE TABLE "auth_rate_limits" (
	"key_hash" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "auth_rate_limits_key_window_unique" UNIQUE("key_hash","window_started_at"),
	CONSTRAINT "auth_rate_limits_attempts_check" CHECK ("auth_rate_limits"."attempts" > 0)
);
--> statement-breakpoint
ALTER TABLE "auth_rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "auth_rate_limits_window_started_at_idx" ON "auth_rate_limits" USING btree ("window_started_at");