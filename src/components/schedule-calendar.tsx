"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import type { EventType } from "@/db/schema";
import { eventTypeCalendarClass } from "@/lib/event-display";
import { cn } from "@/lib/utils";

type CalendarEvent = {
  id: string;
  title: string;
  type: EventType;
  startsAt: Date;
};

type Props = {
  events: CalendarEvent[];
  canAddEvents: boolean;
  timezone: string;
};

function parseMonthParam(raw: string | null): Date {
  if (!raw) return new Date();
  const [yearStr, monthStr] = raw.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return new Date();
  return new Date(year, month - 1, 1);
}

function monthParamOf(date: Date): string {
  return format(date, "yyyy-MM");
}

export function ScheduleCalendar({ events, canAddEvents, timezone }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cursor = parseMonthParam(searchParams.get("m"));

  const { days, eventsByDay } = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const eventsByDay = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      // Bucket by the team-timezone calendar day so a 7pm ET game doesn't
      // jump to the next day for a parent viewing from PT.
      const key = formatInTimeZone(event.startsAt, timezone, "yyyy-MM-dd");
      const bucket = eventsByDay.get(key) ?? [];
      bucket.push(event);
      eventsByDay.set(key, bucket);
    }
    return { days, eventsByDay };
  }, [cursor, events, timezone]);

  function goToMonth(next: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("m", monthParamOf(next));
    router.replace(`/schedule?${params.toString()}`, { scroll: false });
  }

  function handleDayClick(day: Date) {
    if (!canAddEvents) return;
    const dateParam = format(day, "yyyy-MM-dd");
    router.push(`/schedule/new?date=${dateParam}`);
  }

  return (
    <section className="schedule-calendar">
      <header className="cal-head">
        <div className="cal-title">{format(cursor, "MMMM yyyy")}</div>
        <div className="cal-nav">
          <button
            type="button"
            className="cal-nav-btn"
            onClick={() => goToMonth(subMonths(cursor, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className="cal-nav-btn cal-nav-today"
            onClick={() => goToMonth(new Date())}
          >
            Today
          </button>
          <button
            type="button"
            className="cal-nav-btn"
            onClick={() => goToMonth(addMonths(cursor, 1))}
            aria-label="Next month"
          >
            <ChevronRight />
          </button>
          {canAddEvents ? (
            <Link
              href="/schedule/new"
              aria-label="New event"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                height: "34px",
                padding: "0 0.875rem 0 0.75rem",
                marginLeft: "0.5rem",
                borderRadius: "0.5rem",
                background: "var(--orange-strong)",
                color: "white",
                fontSize: "0.78rem",
                fontWeight: 700,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              <PlusIcon />
              <span>New event</span>
            </Link>
          ) : null}
        </div>
      </header>

      <div className="cal-weekdays">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className="cal-weekday">
            {label}
          </div>
        ))}
      </div>

      <div className="cal-grid">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          return (
            <div
              key={key}
              role={canAddEvents ? "button" : undefined}
              tabIndex={canAddEvents ? 0 : -1}
              onClick={() => handleDayClick(day)}
              onKeyDown={(e) => {
                if (canAddEvents && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  handleDayClick(day);
                }
              }}
              className={cn(
                "cal-day",
                !inMonth && "cal-day--other",
                today && "cal-day--today",
                canAddEvents && "cal-day--clickable",
              )}
              aria-label={
                canAddEvents
                  ? `Add event on ${format(day, "EEEE, MMMM d")}`
                  : format(day, "EEEE, MMMM d")
              }
            >
              <div className="cal-day-num">{format(day, "d")}</div>
              {dayEvents.length > 0 ? (
                <div className="cal-events">
                  {dayEvents.slice(0, 3).map((event) => {
                    const eventTime = formatInTimeZone(
                      event.startsAt,
                      timezone,
                      "h:mm a",
                    );

                    return (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        title={`${eventTime} ${event.title}`}
                        onClick={(e) => e.stopPropagation()}
                        className={cn("cal-event", eventTypeCalendarClass(event.type))}
                      >
                        <span className="cal-event-time">{eventTime}</span>
                        <span className="cal-event-title">{event.title}</span>
                      </Link>
                    );
                  })}
                  {dayEvents.length > 3 ? (
                    <div className="cal-event-more">
                      +{dayEvents.length - 3} more
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
