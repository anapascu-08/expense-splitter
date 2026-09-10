"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = {
  system: "Sistem",
  light: "Deschis",
  dark: "Închis",
};
const ICON: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };

function readStored(): Theme {
  try {
    const v = localStorage.getItem("theme");
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* private mode / blocked storage */
  }
  return "system";
}

function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

// The stored choice is external mutable state; useSyncExternalStore keeps the
// button label in step with it (and with the OS, while the choice is "system")
// without a setState-in-effect.
function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (readStored() === "system") apply("system");
    onChange();
  };
  window.addEventListener("storage", handler);
  mq.addEventListener("change", handler);
  return () => {
    window.removeEventListener("storage", handler);
    mq.removeEventListener("change", handler);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    readStored,
    () => "system"
  );

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
    apply(next);
    // `storage` only fires in other tabs — nudge this one to re-render.
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="shrink-0 text-gray-600 transition hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
      aria-label={`Temă: ${LABEL[theme]}. Apasă pentru a schimba.`}
      title={`Temă: ${LABEL[theme]}`}
    >
      <span aria-hidden="true">{ICON[theme]}</span>{" "}
      <span className="sr-only sm:not-sr-only">{LABEL[theme]}</span>
    </button>
  );
}
