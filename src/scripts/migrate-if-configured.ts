import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log(
      "[database] DATABASE_URL is not configured; skipping migrations.",
    );
    return;
  }

  const client = postgres(databaseUrl, { max: 1 });

  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("[database] Migrations are up to date.");
  } finally {
    await client.end();
  }
}

void main();
