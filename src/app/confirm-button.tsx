"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  message: string;
  children: React.ReactNode;
  className?: string;
  /** Label on the destructive confirm button inside the dialog. */
  confirmLabel?: string;
  "aria-label"?: string;
};

// A trigger button that opens a small in-page confirmation dialog before the
// enclosing form's Server Action runs. The confirm button is a real submit
// button inside the same <form>, so pressing it submits as usual. Requires JS
// (like the rest of this app); without it the destructive action is simply
// unavailable, which is the safe default.
export function ConfirmButton({
  message,
  children,
  className,
  confirmLabel = "Șterge",
  ...rest
}: Props) {
  const [open, setOpen] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        {...rest}
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmare"
            className="card w-full max-w-sm bg-white p-4 shadow-lg dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm">{message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => setOpen(false)}
              >
                Anulează
              </button>
              <button
                ref={confirmRef}
                type="submit"
                className="btn-primary border-transparent bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-700"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
