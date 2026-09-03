ALTER TABLE "decks" DROP CONSTRAINT "decks_slug_unique";--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
DO $$
DECLARE
  local_user_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM "decks"
    WHERE "slug" NOT IN ('giao-tiep-hang-ngay', 'gia-dinh-va-ban-be', 'do-an-va-thuc-uong', 'du-lich-co-ban')
  ) THEN
    SELECT "id" INTO local_user_id FROM "users" WHERE "email" = 'demo@vocabloom.vn' LIMIT 1;
    IF local_user_id IS NULL THEN
      RAISE EXCEPTION 'Cannot assign existing personal decks: demo@vocabloom.vn does not exist';
    END IF;
    UPDATE "decks"
    SET "owner_id" = local_user_id
    WHERE "slug" NOT IN ('giao-tiep-hang-ngay', 'gia-dinh-va-ban-be', 'do-an-va-thuc-uong', 'du-lich-co-ban');
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "decks_system_slug_unique" ON "decks" USING btree ("slug") WHERE "decks"."owner_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "decks_owner_slug_unique" ON "decks" USING btree ("owner_id","slug") WHERE "decks"."owner_id" is not null;--> statement-breakpoint
CREATE INDEX "decks_owner_sort_order_idx" ON "decks" USING btree ("owner_id","sort_order");