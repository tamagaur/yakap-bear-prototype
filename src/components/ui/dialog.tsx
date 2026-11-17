"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

/**
 * Accessible modal on the native <dialog> element: it traps focus, closes on
 * Escape and returns focus to the trigger. While `busy` (a submit is running)
 * it can't be closed, so nothing is submitted twice or cancelled halfway.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-panel bg-paper p-0 text-cocoa shadow-lift backdrop:bg-cocoa-950/45 backdrop:backdrop-blur-[2px] open:animate-pop-in"
    >
      {open && (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-card-title font-bold">{title}</h2>
              {description && <p className="mt-1.5 text-body-lg text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-cocoa/5 disabled:opacity-40"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2.5">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
