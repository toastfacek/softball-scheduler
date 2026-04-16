import Link from "next/link";
import { ArrowRight, Clock4, MapPin, UserCheck } from "lucide-react";

import { EventStatusChip, EventTypeChip, ResponseChip } from "@/components/status-chip";
import { formatEventDateTimeRange } from "@/lib/time";
import { formatAddress } from "@/lib/utils";
import type { AttendanceStatus, EventType } from "@/db/schema";

type EventCardProps = {
  event: {
    id: string;
    title: string;
    type: EventType;
    status: "SCHEDULED" | "CANCELED" | "COMPLETED";
    startsAt: Date;
    endsAt: Date | null;
    venueName: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    playerSummary: {
      AVAILABLE: number;
      UNAVAILABLE: number;
      MAYBE: number;
      pending: number;
    };
    viewerPlayers: {
      id: string;
      name: string;
      response: AttendanceStatus | null;
    }[];
  };
};

export function EventCard({ event }: EventCardProps) {
  const location = formatAddress([
    event.venueName,
    event.addressLine1,
    event.addressLine2,
    event.city,
    event.state,
  ]);

  return (
    <Link
      href={`/events/${event.id}`}
      className="shell-panel group relative overflow-hidden flex flex-col gap-5 rounded-4xl p-5 hover:-translate-y-1 sm:p-6"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--orange-strong),color-mix(in_srgb,var(--orange)_70%,white),var(--orange-strong))]" />
      <div className="absolute right-0 top-0 h-28 w-28 bg-[radial-gradient(circle,color-mix(in_srgb,var(--orange)_18%,transparent),transparent_68%)]" />

      <div className="flex flex-wrap items-center gap-2">
        <EventTypeChip type={event.type} />
        <EventStatusChip status={event.status} />
      </div>

      <div className="space-y-3">
        <h3 className="text-3xl leading-none text-navy-strong">
          {event.title}
        </h3>
        <div className="flex items-center gap-2 text-sm font-medium text-[color-mix(in_srgb,var(--navy)_72%,white)]">
          <Clock4 className="h-4 w-4" />
          {formatEventDateTimeRange(event.startsAt, event.endsAt)}
        </div>
        {location ? (
          <div className="flex items-center gap-2 text-sm font-medium text-[color-mix(in_srgb,var(--navy)_72%,white)]">
            <MapPin className="h-4 w-4" />
            {location}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-tile border border-[color-mix(in_srgb,var(--success)_26%,white)] bg-[color-mix(in_srgb,var(--success)_10%,white)] p-3">
          <div className="text-2xl font-black text-[color-mix(in_srgb,var(--success)_78%,black)]">
            {event.playerSummary.AVAILABLE}
          </div>
          <div className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--success)_68%,black)]">
            Available
          </div>
        </div>
        <div className="rounded-tile border border-[color-mix(in_srgb,var(--warning)_26%,white)] bg-[color-mix(in_srgb,var(--warning)_18%,white)] p-3">
          <div className="text-2xl font-black text-[color-mix(in_srgb,var(--warning)_80%,black)]">
            {event.playerSummary.MAYBE}
          </div>
          <div className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--warning)_68%,black)]">
            Maybe
          </div>
        </div>
        <div className="rounded-tile border border-[color-mix(in_srgb,var(--danger)_22%,white)] bg-[color-mix(in_srgb,var(--danger)_10%,white)] p-3">
          <div className="text-2xl font-black text-[color-mix(in_srgb,var(--danger)_82%,black)]">
            {event.playerSummary.UNAVAILABLE}
          </div>
          <div className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--danger)_68%,black)]">
            Out
          </div>
        </div>
        <div className="rounded-tile border border-[color-mix(in_srgb,var(--navy)_12%,white)] bg-[color-mix(in_srgb,var(--navy)_8%,white)] p-3">
          <div className="text-2xl font-black text-navy-strong">
            {event.playerSummary.pending}
          </div>
          <div className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--navy)_68%,white)]">
            Waiting
          </div>
        </div>
      </div>

      {event.viewerPlayers.length > 0 ? (
        <div className="rounded-3xl border border-[color-mix(in_srgb,var(--navy)_12%,white)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--paper)_92%,white),color-mix(in_srgb,var(--paper)_82%,var(--background)))] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-navy-strong">
            <UserCheck className="h-4 w-4" />
            Your family
          </div>
          <div className="flex flex-wrap gap-2">
            {event.viewerPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm font-medium"
              >
                <span>{player.name}</span>
                <ResponseChip status={player.response} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-orange-strong">
        View event details
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
