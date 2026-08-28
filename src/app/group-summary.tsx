import { formatBani } from "@/lib/money";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/lib/categories";
import {
  groupTotal,
  spendByCategory,
  spendByPayer,
  type SummaryExpense,
} from "@/lib/summary";

type Member = { id: string; name: string };

function Bars({
  rows,
}: {
  rows: { key: string; label: string; total: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate">{row.label}</span>
          <span className="h-2 flex-1 rounded bg-gray-100 dark:bg-gray-800">
            <span
              className="block h-2 rounded bg-gray-400 dark:bg-gray-500"
              style={{ width: `${(row.total / max) * 100}%` }}
            />
          </span>
          <span className="w-24 shrink-0 text-right tabular-nums">
            {formatBani(row.total)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function GroupSummary({
  expenses,
  members,
}: {
  expenses: SummaryExpense[];
  members: Member[];
}) {
  if (expenses.length === 0) return null;

  const nameOf = new Map(members.map((m) => [m.id, m.name]));

  const categoryRows = spendByCategory(expenses).map((s) => ({
    key: s.category ?? "__none__",
    label: s.category
      ? `${CATEGORY_ICONS[s.category]} ${CATEGORY_LABELS[s.category]}`
      : "Fără categorie",
    total: s.total,
  }));

  const payerRows = spendByPayer(expenses).map((s) => ({
    key: s.memberId,
    label: nameOf.get(s.memberId) ?? "—",
    total: s.total,
  }));

  return (
    <section className="flex flex-col gap-4 border-t border-gray-200 pt-6 dark:border-gray-800">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">Rezumat</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Total grup: {formatBani(groupTotal(expenses))} RON
        </span>
      </div>

      {categoryRows.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Pe categorii
          </h3>
          <Bars rows={categoryRows} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Cine cât a plătit
        </h3>
        <Bars rows={payerRows} />
      </div>
    </section>
  );
}
