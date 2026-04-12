import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";

import { createEventAction } from "@/actions/event-actions";
import { EventCard } from "@/components/event-card";
import { EventFormFields } from "@/components/event-form-fields";
import { SubmitButton } from "@/components/submit-button";
import { canManageTeam } from "@/lib/authz";
import { getSchedulePageData, getViewerContext } from "@/lib/data";
import { formatEventDateTimeRange } from "@/lib/time";

export default async function SchedulePage() {
  const viewer = await getViewerContext();

  if (!viewer) {
    return null;
  }

  const data = await getSchedulePageData(viewer);

  return (
    <div className="page-grid">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-[color-mix(in_srgb,var(--navy)_26%,black)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--navy-strong)_96%,black),color-mix(in_srgb,var(--navy)_88%,var(--harbor)))] p-6 text-white shadow-[0_32px_60px_color-mix(in_srgb,var(--navy-strong)_22%,transparent)] sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--orange)_30%,transparent),transparent_32%),repeating-linear-gradient(125deg,color-mix(in_srgb,white_7%,transparent)_0_2px,transparent_2px_44px)]" />
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="relative space-y-5">
            <div className="eyebrow flex items-center gap-2 text-[color-mix(in_srgb,var(--orange)_82%,white)]">
              <Sparkles className="h-4 w-4" />
              Game-week control center
            </div>
            <div className="space-y-3">
              <h2 className="max-w-3xl text-5xl leading-[0.92] text-white sm:text-6xl">
                Keep Beverly ready before first pitch.
              </h2>
              <p className="max-w-2xl text-base leading-7 text-white/78">
                Track attendance, tighten logistics, and build lineups from
                real numbers instead of group-text chaos.
              </p>
            </div>

            {data.nextEvent ? (
              <div className="rounded-[1.75rem] border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
                <div className="eyebrow text-white/60">On deck</div>
                <h3 className="mt-2 text-3xl text-white">{data.nextEvent.title}</h3>
                <p className="mt-3 text-sm font-medium text-white/74">
                  {formatEventDateTimeRange(
                    data.nextEvent.startsAt,
                    data.nextEvent.endsAt,
                  )}
                </p>
                <Link
                  href={`/events/${data.nextEvent.id}`}
                  className="mt-5 inline-flex rounded-[1rem] border border-[color-mix(in_srgb,var(--orange)_26%,transparent)] bg-[color-mix(in_srgb,var(--orange)_18%,transparent)] px-4 py-2 text-sm font-black uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--orange)_84%,white)]"
                >
                  Open event
                </Link>
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-white/18 bg-white/8 p-5 text-sm font-medium text-white/72">
                No events yet. Add a practice or game to put the season on the
                board.
              </div>
            )}
          </div>

          <div className="relative grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[1.5rem] border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
              <div className="eyebrow text-white/55">Roster size</div>
              <div className="mt-3 text-4xl font-black text-white">
                {data.stats.playerCount}
              </div>
              <p className="mt-2 text-sm font-medium text-white/72">
                active players in the current season
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[color-mix(in_srgb,var(--orange)_34%,transparent)] bg-[color-mix(in_srgb,var(--orange)_16%,transparent)] p-5">
              <div className="eyebrow text-[color-mix(in_srgb,var(--orange)_82%,white)]">
                Family follow-up
              </div>
              <div className="mt-3 text-4xl font-black text-white">
                {data.stats.needsResponseCount}
              </div>
              <p className="mt-2 text-sm font-medium text-white/74">
                linked-player responses still waiting
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
              <div className="eyebrow text-white/55">Timezone</div>
              <div className="mt-3 text-xl font-black uppercase tracking-[0.08em] text-white">
                Eastern
              </div>
              <p className="mt-2 text-sm font-medium text-white/72">
                all event times are shown in Beverly time
              </p>
            </div>
          </div>
        </div>
      </section>

      {canManageTeam(viewer) ? (
        <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--navy-strong)] text-[var(--orange)] shadow-[0_16px_24px_color-mix(in_srgb,var(--navy-strong)_18%,transparent)]">
              <Plus className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-3xl text-[var(--navy-strong)]">
                Add a practice or game
              </h2>
              <p className="text-sm font-medium text-[color-mix(in_srgb,var(--navy)_70%,white)]">
                Drop in the next event and everyone sees the same plan.
              </p>
            </div>
          </div>
          <form action={createEventAction} className="space-y-5">
            <EventFormFields />
            <SubmitButton label="Create event" />
          </form>
        </section>
      ) : null}

      <section className="page-grid lg:grid-cols-2">
        {data.events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </section>
    </div>
  );
}
