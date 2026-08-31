import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireGroupAccess } from "@/lib/access";
import { CopyButton } from "@/app/copy-button";
import { computeBalances, computeSettlement } from "@/lib/balances";
import { baniToInput, formatMoney, convertToBase } from "@/lib/money";
import {
  addExpense,
  addMember,
  addPayment,
  createInvite,
  deleteExpense,
  deleteGroup,
  deleteMember,
  deletePayment,
  revokeInvite,
  updateGroup,
  updateMember,
} from "@/app/actions";
import { ConfirmButton } from "@/app/confirm-button";
import { SubmitButton } from "@/app/submit-button";
import { FeedbackForm } from "@/app/feedback-form";
import { ExpenseForm } from "@/app/expense-form";
import { GroupSummary } from "@/app/group-summary";
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  isExpenseCategory,
} from "@/lib/categories";

const SPLIT_LABEL: Record<string, string> = {
  EXACT: "sume exacte",
  PERCENT: "procente",
  SHARES: "cote",
};

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role } = await requireGroupAccess(id);
  const isOwner = role === "owner";

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: { orderBy: { name: "asc" } },
      expenses: {
        orderBy: { createdAt: "desc" },
        include: { paidBy: true, participants: { include: { member: true } } },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        include: { from: true, to: true },
      },
      invites: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!group) notFound();

  // Balances, settlement and the summary all work in the group's base currency;
  // each expense is converted from its own currency using the rate stored on it.
  const base = group.baseCurrency;
  const expensesInBase = group.expenses.map((e) => ({
    ...e,
    amount: convertToBase(e.amount, e.rateMicros),
  }));
  const balances = computeBalances(group.members, expensesInBase, group.payments);
  const settlement = computeSettlement(balances);

  // How each member is tied to expenses / payments — drives whether they can be deleted.
  const paidCount = new Map<string, number>();
  const partCount = new Map<string, number>();
  const payCount = new Map<string, number>();
  for (const expense of group.expenses) {
    paidCount.set(expense.paidById, (paidCount.get(expense.paidById) ?? 0) + 1);
    for (const p of expense.participants) {
      partCount.set(p.memberId, (partCount.get(p.memberId) ?? 0) + 1);
    }
  }
  for (const payment of group.payments) {
    payCount.set(payment.fromId, (payCount.get(payment.fromId) ?? 0) + 1);
    payCount.set(payment.toId, (payCount.get(payment.toId) ?? 0) + 1);
  }


  const boundUpdateGroup = updateGroup.bind(null, group.id);
  const boundAddMember = addMember.bind(null, group.id);
  const boundAddExpense = addExpense.bind(null, group.id);
  const boundAddPayment = addPayment.bind(null, group.id);
  const boundCreateInvite = createInvite.bind(null, group.id);

  const hdrs = await headers();
  const origin = `${hdrs.get("x-forwarded-proto") ?? "http"}://${
    hdrs.get("host") ?? "localhost:3000"
  }`;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:underline dark:text-gray-400"
        >
          ← Toate grupurile
        </Link>
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        {isOwner && (
          <details className="text-sm text-gray-500 dark:text-gray-400">
            <summary className="cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
              redenumește / șterge grupul
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <form action={boundUpdateGroup} className="flex gap-2">
                <input
                  type="text"
                  name="name"
                  defaultValue={group.name}
                  required
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-transparent dark:text-gray-100"
                />
                <SubmitButton>Salvează</SubmitButton>
              </form>
              <form action={deleteGroup.bind(null, group.id)}>
                <ConfirmButton
                  message={`Ștergi grupul „${group.name}” cu tot cu membri și cheltuieli? Acțiunea nu poate fi anulată.`}
                  className="text-sm text-red-600 hover:underline dark:text-red-400"
                >
                  Șterge grupul
                </ConfirmButton>
              </form>
            </div>
          </details>
        )}
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Membri</h2>
        {group.members.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Niciun membru încă. Adaugă mai jos.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {group.members.map((member) => {
              const paid = paidCount.get(member.id) ?? 0;
              const parts = partCount.get(member.id) ?? 0;
              const pays = payCount.get(member.id) ?? 0;
              const locked = paid > 0 || parts > 0 || pays > 0;
              const reasons = [
                paid > 0 &&
                  `a plătit ${paid} ${paid === 1 ? "cheltuială" : "cheltuieli"}`,
                parts > 0 &&
                  `participă la ${parts} ${
                    parts === 1 ? "cheltuială" : "cheltuieli"
                  }`,
                pays > 0 &&
                  `apare în ${pays} ${pays === 1 ? "plată" : "plăți"}`,
              ].filter(Boolean);
              const boundUpdateMember = updateMember.bind(
                null,
                group.id,
                member.id
              );

              return (
                <li
                  key={member.id}
                  className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800"
                >
                  <details className="text-sm">
                    <summary className="flex cursor-pointer select-none items-center justify-between">
                      <span className="font-medium">{member.name}</span>
                      <span className="text-xs text-gray-400">editează</span>
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                      <form action={boundUpdateMember} className="flex gap-2">
                        <input
                          type="text"
                          name="name"
                          defaultValue={member.name}
                          required
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-transparent dark:text-gray-100"
                        />
                        <SubmitButton>Salvează</SubmitButton>
                      </form>
                      {locked ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Nu poate fi șters — {reasons.join(" și ")}. Șterge sau
                          reatribuie întâi acele cheltuieli.
                        </p>
                      ) : (
                        <form action={deleteMember.bind(null, group.id, member.id)}>
                          <ConfirmButton
                            message={`Ștergi membrul „${member.name}”?`}
                            className="text-sm text-red-600 hover:underline dark:text-red-400"
                          >
                            Șterge membrul
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        <FeedbackForm action={boundAddMember} rowClassName="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="Nume membru"
            required
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
          />
          <SubmitButton pendingLabel="Se adaugă…">Adaugă membru</SubmitButton>
        </FeedbackForm>
      </section>

      <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
        <h2 className="text-lg font-medium">Cheltuieli</h2>
        {group.members.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Adaugă întâi un membru ca să poți înregistra cheltuieli.
          </p>
        ) : (
          <ExpenseForm
            members={group.members}
            action={boundAddExpense}
            submitLabel="Adaugă cheltuială"
            baseCurrency={base}
          />
        )}
        {group.expenses.length === 0 ? (
          group.members.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nicio cheltuială încă. Adaugă una ca să vezi soldurile.
            </p>
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {group.expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex items-start justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800"
              >
                <div>
                  <p className="font-medium">
                    {expense.category && isExpenseCategory(expense.category) && (
                      <span
                        className="mr-1"
                        title={CATEGORY_LABELS[expense.category]}
                      >
                        {CATEGORY_ICONS[expense.category]}
                      </span>
                    )}
                    {expense.description}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    plătit de {expense.paidBy.name} · împărțit între{" "}
                    {expense.participants.map((p) => p.member.name).join(", ")}
                    {expense.splitMode !== "EQUAL" &&
                      ` · ${SPLIT_LABEL[expense.splitMode] ?? expense.splitMode}`}
                    {expense.category &&
                      isExpenseCategory(expense.category) &&
                      ` · ${CATEGORY_LABELS[expense.category]}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-right font-medium">
                    {formatMoney(expense.amount, expense.currency)}
                    {expense.currency !== base && (
                      <span className="block text-xs font-normal text-gray-400">
                        ≈{" "}
                        {formatMoney(
                          convertToBase(expense.amount, expense.rateMicros),
                          base
                        )}
                      </span>
                    )}
                  </span>
                  <Link
                    href={`/groups/${group.id}/expenses/${expense.id}/edit`}
                    className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    editează
                  </Link>
                  <form action={deleteExpense.bind(null, group.id, expense.id)}>
                    <ConfirmButton
                      message={`Ștergi cheltuiala „${expense.description}”?`}
                      className="text-sm text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      aria-label={`Șterge ${expense.description}`}
                    >
                      șterge
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
        <h2 className="text-lg font-medium">Solduri</h2>
        {group.members.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Adaugă membri pentru a vedea soldurile.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {balances.map((b) => (
              <li key={b.memberId} className="flex justify-between">
                <span>{b.name}</span>
                <span
                  className={
                    b.net > 0
                      ? "text-green-600 dark:text-green-400"
                      : b.net < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-500"
                  }
                >
                  {b.net > 0 ? "i se datorează " : b.net < 0 ? "datorează " : ""}
                  {formatMoney(Math.abs(b.net), base)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {settlement.length > 0 && (
          <div className="mt-2 flex flex-col gap-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900">
            <p className="font-medium">Cum se rezolvă:</p>
            {settlement.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3"
              >
                <p>
                  <span className="font-medium">{t.fromName}</span> îi dă lui{" "}
                  <span className="font-medium">{t.toName}</span>{" "}
                  {formatMoney(t.amount, base)}
                </p>
                <form action={boundAddPayment}>
                  <input type="hidden" name="fromId" value={t.fromId} />
                  <input type="hidden" name="toId" value={t.toId} />
                  <input type="hidden" name="amount" value={baniToInput(t.amount)} />
                  <SubmitButton
                    pendingLabel="…"
                    className="whitespace-nowrap rounded-md border border-gray-300 px-2 py-1 text-xs font-medium transition hover:border-gray-400 disabled:opacity-50 dark:border-gray-700 dark:hover:border-gray-500"
                  >
                    marchează achitat
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
        <h2 className="text-lg font-medium">Plăți</h2>
        {group.payments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nicio plată înregistrată încă.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {group.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm dark:border-gray-800"
              >
                <span>
                  <span className="font-medium">{payment.from.name}</span> →{" "}
                  <span className="font-medium">{payment.to.name}</span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {formatMoney(payment.amount, base)}
                  </span>
                  <form
                    action={deletePayment.bind(null, group.id, payment.id)}
                  >
                    <ConfirmButton
                      message={`Ștergi plata ${payment.from.name} → ${payment.to.name} (${formatMoney(
                        payment.amount,
                        base
                      )})?`}
                      className="text-sm text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      șterge
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {group.members.length >= 2 && (
          <form
            action={boundAddPayment}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="flex flex-1 flex-col gap-1 text-sm">
              De la
              <select
                name="fromId"
                required
                defaultValue=""
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
              >
                <option value="" disabled>
                  —
                </option>
                {group.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Către
              <select
                name="toId"
                required
                defaultValue=""
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
              >
                <option value="" disabled>
                  —
                </option>
                {group.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Sumă ({base})
              <input
                type="text"
                inputMode="decimal"
                name="amount"
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
              />
            </label>
            <SubmitButton pendingLabel="Se adaugă…">Adaugă plată</SubmitButton>
          </form>
        )}
      </section>


      <GroupSummary
        expenses={expensesInBase}
        members={group.members}
        currency={base}
      />

      <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
        <h2 className="text-lg font-medium">Invită pe cineva</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Oricine deschide un link activ și e autentificat intră în grup.
          Linkurile expiră după 7 zile.
        </p>
        {group.invites.length > 0 && (
          <ul className="flex flex-col gap-2">
            {group.invites.map((invite) => {
              const url = `${origin}/invite/${invite.token}`;
              return (
                <li
                  key={invite.token}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm dark:border-gray-800"
                >
                  <code className="truncate text-gray-600 dark:text-gray-300">
                    {url}
                  </code>
                  <div className="flex shrink-0 items-center gap-3">
                    <CopyButton
                      text={url}
                      className="text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    />
                    <form
                      action={revokeInvite.bind(null, group.id, invite.token)}
                    >
                      <SubmitButton
                        pendingLabel="…"
                        className="text-gray-400 transition hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                      >
                        revocă
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <form action={boundCreateInvite}>
          <SubmitButton pendingLabel="Se generează…">
            Generează link de invitație
          </SubmitButton>
        </form>
      </section>

      <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
        <h2 className="text-lg font-medium">Export</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <a
            href={`/groups/${group.id}/export?type=expenses`}
            className="rounded-lg border border-gray-300 px-4 py-2 font-medium transition hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
          >
            Cheltuieli (CSV)
          </a>
          <a
            href={`/groups/${group.id}/export?type=expenses&format=pdf`}
            className="rounded-lg border border-gray-300 px-4 py-2 font-medium transition hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
          >
            Cheltuieli (PDF)
          </a>
          <a
            href={`/groups/${group.id}/export?type=balances`}
            className="rounded-lg border border-gray-300 px-4 py-2 font-medium transition hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
          >
            Solduri (CSV)
          </a>
          <a
            href={`/groups/${group.id}/export?type=balances&format=pdf`}
            className="rounded-lg border border-gray-300 px-4 py-2 font-medium transition hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
          >
            Solduri (PDF)
          </a>
        </div>
      </section>
    </main>
  );
}
