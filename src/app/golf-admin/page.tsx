import GolfTournamentAdminPage from "@/app/(app)/settings/golf-tournament/page";
import { requireGolfAdmin } from "@/lib/golf-tournament/admin-auth";

export const dynamic = "force-dynamic";

type GolfAdminPageProps = {
  searchParams?: Promise<{ saved?: string; view?: string }>;
};

export default async function GolfAdminPage(props: GolfAdminPageProps) {
  await requireGolfAdmin();

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <GolfTournamentAdminPage {...props} />
      </div>
    </main>
  );
}
