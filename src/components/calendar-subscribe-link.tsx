import Link from "next/link";
import { CalendarPlus, ChevronRight } from "lucide-react";

type CalendarSubscribeLinkProps = {
  className?: string;
};

export function CalendarSubscribeLink({
  className = "",
}: CalendarSubscribeLinkProps) {
  return (
    <Link
      href="/settings/calendar"
      className={`action-row calendar-subscribe-link ${className}`.trim()}
    >
      <div className="action-icon">
        <CalendarPlus aria-hidden="true" size={18} strokeWidth={2.2} />
      </div>
      <div className="row-grow">
        <div className="row-title">Subscribe to calendar</div>
        <div className="row-sub">Add the full team schedule to your phone</div>
      </div>
      <ChevronRight
        className="row-chevron"
        aria-hidden="true"
        size={16}
        strokeWidth={2}
      />
    </Link>
  );
}
