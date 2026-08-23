"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const sectionIds = ["overview", "payments", "in-kind", "cleanup"] as const;

type SectionId = (typeof sectionIds)[number];

type GolfAdminRailProps = {
  openInKindCount: number;
  cleanupCount: number;
};

const sectionLabels: Record<SectionId, string> = {
  overview: "Overview",
  payments: "Payments",
  "in-kind": "In-kind queue",
  cleanup: "Cleanup",
};

export function GolfAdminRail({
  openInKindCount,
  cleanupCount,
}: GolfAdminRailProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");

  useEffect(() => {
    const updateActiveSection = () => {
      const marker = window.scrollY + window.innerHeight * 0.3;
      let nextSection: SectionId = "overview";

      for (const sectionId of sectionIds) {
        const section = document.getElementById(sectionId);
        if (!section) continue;

        const top = section.getBoundingClientRect().top + window.scrollY;
        if (top <= marker) nextSection = sectionId;
      }

      setActiveSection(nextSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    window.addEventListener("hashchange", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
      window.removeEventListener("hashchange", updateActiveSection);
    };
  }, []);

  return (
    <aside className="golf-admin-rail" aria-label="Golf tournament navigation">
      <div className="golf-admin-rail-brand">
        <span className="golf-admin-rail-mark">BGSL</span>
        <div>
          <strong>Golf tournament</strong>
          <span>BGSL operations</span>
        </div>
      </div>

      <div className="golf-admin-rail-section">
        <span className="eyebrow">Tournament</span>
        <nav className="golf-admin-rail-nav" aria-label="Dashboard sections">
          {sectionIds.map((sectionId) => {
            const active = activeSection === sectionId;
            const count =
              sectionId === "in-kind"
                ? openInKindCount
                : sectionId === "cleanup"
                  ? cleanupCount
                  : null;

            return (
              <a
                key={sectionId}
                href={`#${sectionId}`}
                className={active ? "is-active" : undefined}
                aria-current={active ? "location" : undefined}
                onClick={() => setActiveSection(sectionId)}
              >
                <span>{sectionLabels[sectionId]}</span>
                {count !== null ? <span>{count > 0 ? count : "—"}</span> : null}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="golf-admin-rail-footer">
        <Link href="/golf-tournament">View public page</Link>
      </div>
    </aside>
  );
}
