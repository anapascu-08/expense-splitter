import { formatMoney } from "@/lib/money";
import { formatRelativeTime } from "@/lib/relative-time";
import {
  buildActivity,
  type ActivityExpense,
  type ActivityPayment,
} from "@/lib/activity";

type Props = {
  expenses: ActivityExpense[];
  payments: ActivityPayment[];
  baseCurrency: string;
};

// The in-app stand-in for a "new expense" notification: the most recent
// expenses and payments in one chronological list, no email/push involved.
export function ActivityFeed({ expenses, payments, baseCurrency }: Props) {
  const items = buildActivity(expenses, payments);
  if (items.length === 0) return null;

  const now = new Date();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Activitate recentă</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {items.map((item) => (
          <li
            key={`${item.type}-${item.id}`}
            className="card flex items-baseline justify-between gap-3 px-4 py-2"
          >
            {item.type === "expense" ? (
              <span className="truncate">
                💸 <span className="font-medium">{item.paidByName}</span> a
                adăugat „{item.description}”
              </span>
            ) : (
              <span className="truncate">
                ✅ <span className="font-medium">{item.fromName}</span> i-a
                plătit lui <span className="font-medium">{item.toName}</span>
              </span>
            )}
            <span className="shrink-0 text-right tabular-nums text-gray-500 dark:text-gray-400">
              {formatMoney(
                item.amount,
                item.type === "expense" ? item.currency : baseCurrency
              )}{" "}
              · {formatRelativeTime(item.createdAt, now)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
