"use client";

import { useState } from "react";

type Props = {
  httpsUrl: string;
  webcalUrl: string;
};

export function CopyableUrl({ httpsUrl, webcalUrl }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers / non-secure contexts: fall back to selecting.
      window.prompt("Copy this URL", httpsUrl);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3">
      <div className="flex flex-col gap-2">
        <label
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "color-mix(in srgb, var(--navy) 70%, white)" }}
        >
          Subscription URL
        </label>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={httpsUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-xl border border-line bg-[color:var(--paper)] px-3 py-2 text-xs"
            style={{ fontFamily: "monospace" }}
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-[color:var(--paper)]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <a
          href={webcalUrl}
          className="text-xs font-semibold"
          style={{ color: "var(--orange)" }}
        >
          Open in default calendar app (webcal://)
        </a>
      </div>
    </div>
  );
}
