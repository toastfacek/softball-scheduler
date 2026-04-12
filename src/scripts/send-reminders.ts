import { runReminderSweep } from "../lib/reminders";

async function main() {
  const results = await runReminderSweep();
  console.log(JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

