"use client";

import { useEffect } from "react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  body?: string;
  primaryLabel?: string;
  onClose: () => void;
};

/**
 * Centered confirmation modal — success-state, one primary button.
 * Closes on ESC and backdrop click. Use for "Saved", "Sent", etc.
 */
export function ConfirmModal({
  open,
  title,
  body,
  primaryLabel = "Done",
  onClose,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="confirm-modal-backdrop" onClick={onClose}>
      <div
        className="confirm-modal shell-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="orange-bar-top" />
        <div className="confirm-modal-icon">
          <svg
            width="26"
            height="26"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 id="confirm-modal-title" className="confirm-modal-title">
          {title}
        </h3>
        {body ? <p className="confirm-modal-body">{body}</p> : null}
        <button
          type="button"
          className="btn-primary btn-block"
          onClick={onClose}
          autoFocus
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
