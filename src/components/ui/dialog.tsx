"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

/** Accessible modal built on the native <dialog> element. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
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
        onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-3xl bg-white p-0 text-cocoa-900 shadow-lift backdrop:bg-cocoa-950/40 backdrop:backdrop-blur-[2px]"
    >
      {open && (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold">{title}</h2>
              {description && <p className="mt-1 text-sm text-cocoa-600">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 -mt-2 grid size-9 place-items-center rounded-full text-cocoa-500 hover:bg-cream-100"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
