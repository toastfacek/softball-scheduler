"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div
        className="bottom-sheet-backdrop bottom-sheet-backdrop--open"
        onClick={onClose}
      />
      <div
        className="bottom-sheet bottom-sheet--open"
        role="dialog"
        aria-modal="true"
      >
        <div className="bottom-sheet-handle" />
        {title ? <div className="bottom-sheet-title">{title}</div> : null}
        {children}
      </div>
    </>
  );
}
