"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  /** Shown while the form's Server Action is running. */
  pendingLabel?: string;
  className?: string;
  variant?: "default" | "primary";
};

const BASE =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50";
const VARIANTS = {
  default:
    "border border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500",
  primary:
    "bg-accent text-white hover:bg-accent-hover dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200",
};

// Submit button that reflects the pending state of its enclosing <form> — the
// spec's "feedback imediat la fiecare acțiune". Must live inside a <form>.
export function SubmitButton({
  children,
  pendingLabel = "Se salvează…",
  className,
  variant = "default",
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className ?? `${BASE} ${VARIANTS[variant]}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
