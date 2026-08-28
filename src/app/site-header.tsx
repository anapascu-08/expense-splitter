import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/auth-actions";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold">
          Expense Splitter
        </Link>
        {user ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500 dark:text-gray-400">{user.name}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Deconectare
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-sm text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            Autentificare
          </Link>
        )}
      </div>
    </header>
  );
}
