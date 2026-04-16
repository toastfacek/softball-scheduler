import { cn } from "@/lib/utils";
import type { AttendanceStatus, EventStatus, EventType } from "@/db/schema";
import { eventTypeLabel } from "@/lib/event-display";

const responseStyles: Record<AttendanceStatus, string> = {
  AVAILABLE:
    "border-[color-mix(in_srgb,var(--success)_36%,white)] bg-[color-mix(in_srgb,var(--success)_18%,white)] text-[color-mix(in_srgb,var(--success)_72%,black)]",
  MAYBE:
    "border-[color-mix(in_srgb,var(--warning)_36%,white)] bg-[color-mix(in_srgb,var(--warning)_24%,white)] text-[color-mix(in_srgb,var(--warning)_74%,black)]",
  UNAVAILABLE:
    "border-[color-mix(in_srgb,var(--danger)_30%,white)] bg-[color-mix(in_srgb,var(--danger)_16%,white)] text-[color-mix(in_srgb,var(--danger)_78%,black)]",
};

const eventStyles: Record<EventType, string> = {
  GAME:
    "border-[color-mix(in_srgb,var(--orange)_36%,white)] bg-[color-mix(in_srgb,var(--orange)_18%,white)] text-navy-strong",
  PRACTICE:
    "border-[color-mix(in_srgb,var(--navy)_16%,white)] bg-[color-mix(in_srgb,var(--navy)_8%,white)] text-navy",
  TEAM_EVENT:
    "border-[color-mix(in_srgb,var(--warning)_36%,white)] bg-[color-mix(in_srgb,var(--warning)_18%,white)] text-[color-mix(in_srgb,var(--warning)_74%,black)]",
};

const eventStatusStyles: Record<EventStatus, string> = {
  SCHEDULED:
    "border-[color-mix(in_srgb,var(--navy)_16%,white)] bg-[color-mix(in_srgb,var(--navy)_10%,white)] text-navy-strong",
  CANCELED:
    "border-[color-mix(in_srgb,var(--danger)_28%,white)] bg-[color-mix(in_srgb,var(--danger)_14%,white)] text-[color-mix(in_srgb,var(--danger)_82%,black)]",
  COMPLETED:
    "border-[color-mix(in_srgb,var(--success)_30%,white)] bg-[color-mix(in_srgb,var(--success)_14%,white)] text-[color-mix(in_srgb,var(--success)_78%,black)]",
};

export function ResponseChip({
  status,
  className,
}: {
  status: AttendanceStatus | null;
  className?: string;
}) {
  if (!status) {
    return (
      <span
        className={cn(
          "inline-flex rounded-[0.8rem] border border-dashed border-line px-3 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--navy)_64%,white)]",
          className,
        )}
      >
        Waiting
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-[0.8rem] border px-3 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.14em]",
        responseStyles[status],
        className,
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}

export function EventTypeChip({ type }: { type: EventType }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-[0.8rem] border px-3 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.18em]",
        eventStyles[type],
      )}
    >
      {eventTypeLabel(type)}
    </span>
  );
}

export function EventStatusChip({ status }: { status: EventStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-[0.8rem] border px-3 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.14em]",
        eventStatusStyles[status],
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}
