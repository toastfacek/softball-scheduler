import Link from "next/link";
import type { ReactNode } from "react";

import { BackButton } from "@/components/back-button";

type PageHeaderProps = {
  title: string;
  /** Href to link to for a back chevron in the left slot. */
  back?: string;
  /** Content for the right slot (usually an action icon-button). */
  action?: ReactNode;
};

export function PageHeader({ title, back, action }: PageHeaderProps) {
  return (
    <header className="app-top-bar">
      <div className="app-top-bar-inner">
        <div className="app-top-bar-left">
          {back ? (
            <Link href={back} className="icon-btn" aria-label="Back">
              <ChevronLeftIcon />
            </Link>
          ) : null}
        </div>
        <div className="app-top-bar-title">{title}</div>
        <div className="app-top-bar-right">{action}</div>
      </div>
    </header>
  );
}

/** Drop-in "back to previous page" variant using browser history. */
export function PageHeaderWithHistoryBack({
  title,
  action,
}: Omit<PageHeaderProps, "back">) {
  return (
    <header className="app-top-bar">
      <div className="app-top-bar-inner">
        <div className="app-top-bar-left">
          <BackButton />
        </div>
        <div className="app-top-bar-title">{title}</div>
        <div className="app-top-bar-right">{action}</div>
      </div>
    </header>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="20"
      height="20"
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
