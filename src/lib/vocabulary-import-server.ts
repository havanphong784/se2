import { and, desc, eq, max, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { decks, words } from "@/db/schema";
import type { ImportedWord } from "@/lib/vocabulary-import";

type Destination =
  | { type: "new"; title: string; description: string; level: string }
  | { type: "existing"; deckId: string };

export class ImportError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function slugify(title: string) {
  return (
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "bo-tu"
  );
}

export async function importVocabulary(
  destination: Destination,
  importedWords: ImportedWord[],
  userId: string,
) {
  const db = getDb();
  if (!db) throw new ImportError("DATABASE_NOT_CONFIGURED", "Database chưa được cấu hình.", 503);

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 1))`,
    );

    let deck: { id: string; slug: string; title: string };
    if (destination.type === "existing") {
      const [ownedDeck] = await tx
        .select({ id: decks.id, slug: decks.slug, title: decks.title })
        .from(decks)
        .where(and(eq(decks.id, destination.deckId), eq(decks.ownerId, userId)))
        .limit(1);
      if (!ownedDeck) throw new ImportError("DECK_NOT_FOUND", "Không tìm thấy bộ từ cá nhân.", 404);
      deck = ownedDeck;
    } else {
      const title = destination.title.normalize("NFC").trim();
      if (!title || [...title].length > 120) {
        throw new ImportError("INVALID_DECK", "Tên bộ từ không hợp lệ.", 400);
      }
      const base = slugify(title);
      const existing = await tx
        .select({ slug: decks.slug })
        .from(decks)
        .where(eq(decks.ownerId, userId));
      const used = new Set(existing.map((item) => item.slug));
      let slug = base;
      for (let suffix = 2; used.has(slug); suffix += 1) slug = `${base}-${suffix}`;
      const [{ nextOrder }] = await tx
        .select({ nextOrder: sql<number>`coalesce(max(${decks.sortOrder}), -1)::int + 1` })
        .from(decks)
        .where(eq(decks.ownerId, userId));
      const [created] = await tx
        .insert(decks)
        .values({
          ownerId: userId,
          slug,
          title,
          description: destination.description.normalize("NFC").trim().slice(0, 500),
          level: destination.level.normalize("NFC").trim().slice(0, 40) || "Tự chọn",
          sortOrder: nextOrder,
        })
        .returning({ id: decks.id, slug: decks.slug, title: decks.title });
      deck = created;
    }

    const [{ maximum }] = await tx
      .select({ maximum: max(words.sortOrder) })
      .from(words)
      .where(eq(words.deckId, deck.id));
    const startOrder = (maximum ?? -1) + 1;
    const inserted = await tx
      .insert(words)
      .values(
        importedWords.map((word, index) => ({
          deckId: deck.id,
          ...word,
          sortOrder: startOrder + index,
        })),
      )
      .onConflictDoNothing({ target: [words.deckId, words.term] })
      .returning({ id: words.id });

    return {
      deck,
      imported: inserted.length,
      skippedDuplicates: importedWords.length - inserted.length,
    };
  });
}

export async function getPersonalImportDecks(userId: string) {
  const db = getDb();
  if (!db) return { available: false as const, decks: [] };
  const ownedDecks = await db
    .select({ id: decks.id, title: decks.title, slug: decks.slug })
    .from(decks)
    .where(eq(decks.ownerId, userId))
    .orderBy(desc(decks.updatedAt));
  return { available: true as const, decks: ownedDecks };
}
