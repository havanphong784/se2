import { getDb, closeDb } from "../src/db";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth-crypto";

async function run() {
  const db = getDb();
  if (!db) {
    console.error("No database connection available.");
    process.exit(1);
  }

  const email = "tu123@gmail.com";
  const password = "123456";
  const displayName = "tu123";
  const passwordHash = hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({
      email,
      displayName,
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        passwordHash,
        displayName,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    });

  console.log("USER_CREATED:", JSON.stringify(user));
  await closeDb();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
