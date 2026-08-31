import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createGroup } from "./actions";
import { SubmitButton } from "@/app/submit-button";
import { FeedbackForm } from "@/app/feedback-form";
import { CURRENCY_CODES, DEFAULT_CURRENCY } from "@/lib/currencies";

export default async function HomePage() {
  const user = await requireUser();
  const groups = await prisma.group.findMany({
    where: { groupMembers: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" },
    include: { members: true },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Expense Splitter</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Împarte cheltuielile cu prietenii, fără bătăi de cap.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Grupurile tale</h2>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nu ai niciun grup încă. Creează unul mai jos.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.map((group) => (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 transition hover:border-gray-400 dark:border-gray-800 dark:hover:border-gray-600"
                >
                  <span className="font-medium">{group.name}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {group.members.length}{" "}
                    {group.members.length === 1 ? "membru" : "membri"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
        <h2 className="text-lg font-medium">Creează un grup nou</h2>
        <FeedbackForm action={createGroup} rowClassName="flex flex-wrap gap-2">
          <input
            type="text"
            name="name"
            placeholder="ex: Vacanța la mare"
            required
            className="flex-1 field"
          />
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Valuta de bază</span>
            <select
              name="baseCurrency"
              defaultValue={DEFAULT_CURRENCY}
              aria-label="Valuta de bază"
              className="field"
            >
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <SubmitButton variant="primary" pendingLabel="Se creează…">
            Creează
          </SubmitButton>
        </FeedbackForm>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Valuta de bază nu se mai poate schimba după creare. Cheltuielile pot fi
          în alte valute, cu un curs introdus manual.
        </p>
      </section>
    </main>
  );
}
