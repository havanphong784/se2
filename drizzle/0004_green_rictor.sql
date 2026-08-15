ALTER TABLE "words" ALTER COLUMN "part_of_speech" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "words" ALTER COLUMN "part_of_speech" SET DATA TYPE text[] USING CASE
  WHEN btrim("part_of_speech") = '' THEN '{}'::text[]
  ELSE ARRAY[btrim("part_of_speech")]
END;--> statement-breakpoint
ALTER TABLE "words" ALTER COLUMN "part_of_speech" SET DEFAULT '{}'::text[];