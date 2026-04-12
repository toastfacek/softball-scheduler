import { differenceInHours } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { APP_TIMEZONE } from "@/lib/constants";

export function localInputToDate(value: string, timezone = APP_TIMEZONE) {
  return fromZonedTime(value, timezone);
}

export function dateToLocalInput(date: Date, timezone = APP_TIMEZONE) {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd'T'HH:mm");
}

export function formatEventDay(date: Date, timezone = APP_TIMEZONE) {
  return formatInTimeZone(date, timezone, "EEE, MMM d");
}

export function formatEventTime(date: Date, timezone = APP_TIMEZONE) {
  return formatInTimeZone(date, timezone, "h:mm a");
}

export function formatEventDateTimeRange(
  startsAt: Date,
  endsAt?: Date | null,
  timezone = APP_TIMEZONE,
) {
  const day = formatInTimeZone(startsAt, timezone, "EEEE, MMMM d");
  const start = formatInTimeZone(startsAt, timezone, "h:mm a");

  if (!endsAt) {
    return `${day} at ${start}`;
  }

  const end = formatInTimeZone(endsAt, timezone, "h:mm a");

  return `${day} · ${start} to ${end}`;
}

export function hoursUntil(date: Date) {
  return differenceInHours(date, new Date());
}

