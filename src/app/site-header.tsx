import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/auth-actions";
import { ThemeToggle } from "@/app/theme-toggle";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3.5 lg:max-w-6xl">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-semibold"
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            className="shrink-0 text-accent"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v18" />
            <path d="M6 9h4M6 12h4M15 12h3M15 15h3" strokeWidth="1.6" />
          </svg>
          Expense Splitter
        </Link>
        <div className="flex min-w-0 items-center gap-3 text-base">
          <ThemeToggle />
          <span
            aria-hidden="true"
            className="shrink-0 text-gray-300 dark:text-gray-700"
          >
            ·
          </span>
          {user ? (
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-gray-700 dark:text-gray-200">
                {user.name}
              </span>
              <span
                aria-hidden="true"
                className="shrink-0 text-gray-300 dark:text-gray-700"
              >
                ·
              </span>
              <form action={logout} className="shrink-0">
                <button
                  type="submit"
                  className="text-gray-600 transition hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                >
                  Deconectare
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="shrink-0 text-gray-600 transition hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            >
              Autentificare
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
