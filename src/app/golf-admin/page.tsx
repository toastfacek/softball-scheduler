import GolfTournamentAdminPage from "@/app/(app)/settings/golf-tournament/page";
import { requireGolfAdmin } from "@/lib/golf-tournament/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type GolfAdminPageProps = {
  searchParams?: Promise<{
    saved?: string;
    view?: string;
    sync?: string;
    imported?: string;
    updated?: string;
    existing?: string;
    scanned?: string;
    links?: string;
    configuredLinks?: string;
    failed?: string;
  }>;
};

export default async function GolfAdminPage(props: GolfAdminPageProps) {
  await requireGolfAdmin();

  return (
    <main className="golf-admin-page min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <GolfTournamentAdminPage {...props} />
      </div>
    </main>
  );
}
