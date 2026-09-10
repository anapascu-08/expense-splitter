import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireGroupAccess } from "@/lib/access";
import { CopyButton } from "@/app/copy-button";
import { computeBalances, computeSettlement } from "@/lib/balances";
import { baniToInput, formatMoney, convertToBase } from "@/lib/money";
import { formatRelativeTime } from "@/lib/relative-time";
import { toDative } from "@/lib/romanian";
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
  unlinkMember,
  archiveMember,
  unarchiveMember,
  updateGroup,
  updateMember,
} from "@/app/actions";
import { BackLink } from "@/app/back-link";
import { ConfirmButton } from "@/app/confirm-button";
import { SubmitButton } from "@/app/submit-button";
import { FeedbackForm } from "@/app/feedback-form";
import { QuickPayForm } from "@/app/quick-pay-form";
import { ExpenseForm } from "@/app/expense-form";
import { GroupSummary } from "@/app/group-summary";
import { ActivityFeed } from "@/app/activity-feed";
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
  const { user, role } = await requireGroupAccess(id);
  const isOwner = role === "owner";
  // Owner can touch anything; a plain member only rows they created.
  const canMutate = (createdById: string | null) =>
    isOwner || (createdById !== null && createdById === user.id);

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true } },
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

  // Archived members keep their history (expense rows, payment rows, the feed
  // still name them) but drop out of every picker, the balances list and the
  // settlement.
  const activeMembers = group.members.filter((m) => !m.archivedAt);
  const archivedMembers = group.members.filter((m) => m.archivedAt);

  // Balances, settlement and the summary all work in the group's base currency;
  // each expense is converted from its own currency using the rate stored on it.
  const base = group.baseCurrency;
  const expensesInBase = group.expenses.map((e) => ({
    ...e,
    amount: convertToBase(e.amount, e.rateMicros),
  }));
  const balances = computeBalances(activeMembers, expensesInBase, group.payments);
  const settlement = computeSettlement(balances);
  const netByMember = new Map(balances.map((b) => [b.memberId, b.net]));

  // The in-app "notification" feed: no email/push, just the most recent
  // expenses and payments merged into one chronological list (Faza 5).
  const activityExpenses = group.expenses.map((e) => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    createdAt: e.createdAt,
    paidByName: e.paidBy.name,
  }));
  const activityPayments = group.payments.map((p) => ({
    id: p.id,
    amount: p.amount,
    createdAt: p.createdAt,
    fromName: p.from.name,
    toName: p.to.name,
  }));

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


  const boundCreateInvite = createInvite.bind(null, group.id);
  const now = new Date();

  const hdrs = await headers();
  const origin = `${hdrs.get("x-forwarded-proto") ?? "http"}://${
    hdrs.get("host") ?? "localhost:3000"
  }`;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 lg:max-w-6xl">
      <header className="flex flex-col gap-3">
        <BackLink href="/">Toate grupurile</BackLink>
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Administrat de{" "}
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {group.owner.name}
            {isOwner && " (tu)"}
          </span>
        </p>
        {isOwner && (
          <details className="text-sm text-gray-600 dark:text-gray-300">
            <summary className="cursor-pointer select-none font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100">
              redenumește / șterge grupul
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <FeedbackForm action={updateGroup} rowClassName="flex gap-2">
                <input type="hidden" name="groupId" value={group.id} />
                <input
                  type="text"
                  name="name"
                  defaultValue={group.name}
                  required
                  className="field flex-1 text-gray-900 dark:text-gray-100"
                />
                <SubmitButton>Salvează</SubmitButton>
              </FeedbackForm>
              <form action={deleteGroup.bind(null, group.id)}>
                <ConfirmButton
                  message={`Ștergi grupul „${group.name}” cu tot cu membri și cheltuieli? Acțiunea nu poate fi anulată.`}
                  className="btn-link-danger"
                >
                  Șterge grupul
                </ConfirmButton>
              </form>
            </div>
          </details>
        )}
      </header>

      <ActivityFeed
        expenses={activityExpenses}
        payments={activityPayments}
        baseCurrency={base}
      />

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-8 lg:col-start-1 lg:row-start-1">
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Membri</h2>
            {activeMembers.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Niciun membru încă. Adaugă mai jos.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {activeMembers.map((member) => {
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
                  return (
                    <li
                      key={member.id}
                      className="card px-4 py-3"
                    >
                      <details className="text-sm">
                        <summary className="flex cursor-pointer select-none items-center justify-between gap-2">
                          <span className="font-medium">
                            {member.name}
                            {member.userId === group.ownerId ? (
                              <span className="ml-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                                owner
                              </span>
                            ) : (
                              member.userId && (
                                <span className="ml-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                                  revendicat
                                </span>
                              )
                            )}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-300">editează</span>
                        </summary>
                        <div className="mt-3 flex flex-col gap-3">
                          <FeedbackForm
                            action={updateMember}
                            rowClassName="flex gap-2"
                          >
                            <input
                              type="hidden"
                              name="groupId"
                              value={group.id}
                            />
                            <input
                              type="hidden"
                              name="memberId"
                              value={member.id}
                            />
                            <input
                              type="text"
                              name="name"
                              defaultValue={member.name}
                              required
                              className="field flex-1 text-gray-900 dark:text-gray-100"
                            />
                            <SubmitButton>Salvează</SubmitButton>
                          </FeedbackForm>
                          {isOwner &&
                            locked &&
                            (member.userId === group.ownerId ? (
                              <p className="text-xs text-gray-600 dark:text-gray-300">
                                {reasons.join(" și ")}. Nu poate fi șters
                                (ștergerea ar rescrie cheltuielile trecute);
                                redenumirea merge oricând.
                              </p>
                            ) : (netByMember.get(member.id) ?? 0) === 0 ? (
                              <div className="flex flex-col gap-2">
                                <p className="text-xs text-gray-600 dark:text-gray-300">
                                  {reasons.join(" și ")} — nu poate fi șters
                                  (ștergerea ar rescrie cheltuielile trecute).
                                  Soldul e zero, deci poate fi arhivat: iese din
                                  liste, dar rămâne în istoric.
                                </p>
                                <form
                                  action={archiveMember.bind(
                                    null,
                                    group.id,
                                    member.id
                                  )}
                                >
                                  <ConfirmButton
                                    message={`Arhivezi „${member.name}”? Nu va mai apărea la cheltuieli, plăți sau solduri, dar rămâne în istoric. Poți dezarhiva oricând.`}
                                    className="btn-link-danger"
                                    confirmLabel="Arhivează"
                                  >
                                    Arhivează membrul
                                  </ConfirmButton>
                                </form>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-600 dark:text-gray-300">
                                {reasons.join(" și ")}. Nu poate fi șters
                                (ștergerea ar rescrie cheltuielile trecute) și
                                nici arhivat cât timp are sold nedecontat —
                                decontează-l întâi.
                              </p>
                            ))}
                          {isOwner && !locked && (
                            <form action={deleteMember.bind(null, group.id, member.id)}>
                              <ConfirmButton
                                message={`Ștergi membrul „${member.name}”?`}
                                className="btn-link-danger"
                              >
                                Șterge membrul
                              </ConfirmButton>
                            </form>
                          )}
                          {isOwner &&
                            member.userId &&
                            member.userId !== group.ownerId && (
                              <form
                                action={unlinkMember.bind(
                                  null,
                                  group.id,
                                  member.id
                                )}
                              >
                                <ConfirmButton
                                  message={`Persoana asta nu e „${member.name}”? Contul legat pierde accesul la grup, iar numele redevine liber pentru a fi revendicat.`}
                                  className="btn-link-danger"
                                  confirmLabel="Anulează revendicarea"
                                >
                                  Anulează revendicarea contului
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
            <FeedbackForm action={addMember} rowClassName="flex items-end gap-2">
              <input type="hidden" name="groupId" value={group.id} />
              <label className="flex flex-1 flex-col gap-1 text-sm">
                Nume
                <input
                  type="text"
                  name="name"
                  placeholder="ex: Maria"
                  required
                  className="field"
                />
              </label>
              <SubmitButton pendingLabel="Se adaugă…">Adaugă membru</SubmitButton>
            </FeedbackForm>

            {archivedMembers.length > 0 && (
              <details className="text-sm text-gray-600 dark:text-gray-300">
                <summary className="cursor-pointer select-none font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100">
                  Arhivați ({archivedMembers.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {archivedMembers.map((member) => (
                    <li
                      key={member.id}
                      className="card flex items-center justify-between px-4 py-2"
                    >
                      <span>{member.name}</span>
                      {isOwner && (
                        <form
                          action={unarchiveMember.bind(
                            null,
                            group.id,
                            member.id
                          )}
                        >
                          <button
                            type="submit"
                            className="text-sm font-medium text-gray-700 transition hover:underline dark:text-gray-200"
                          >
                            Dezarhivează
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
            <h2 className="text-lg font-medium">Cheltuieli</h2>
            {activeMembers.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Adaugă întâi un membru ca să poți înregistra cheltuieli.
              </p>
            ) : (
              <ExpenseForm
                members={activeMembers}
                action={addExpense}
                groupId={group.id}
                submitLabel="Adaugă cheltuială"
                baseCurrency={base}
              />
            )}
            {group.expenses.length === 0 ? (
              activeMembers.length > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Nicio cheltuială încă. Adaugă una ca să vezi soldurile.
                </p>
              )
            ) : (
              <ul className="flex flex-col gap-2">
                {group.expenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="flex items-start justify-between card px-4 py-3"
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
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        plătit de {expense.paidBy.name} · împărțit între{" "}
                        {expense.participants.map((p) => p.member.name).join(", ")}
                        {expense.splitMode !== "EQUAL" &&
                          ` · ${SPLIT_LABEL[expense.splitMode] ?? expense.splitMode}`}
                        {expense.category &&
                          isExpenseCategory(expense.category) &&
                          ` · ${CATEGORY_LABELS[expense.category]}`}
                        {" · "}
                        {formatRelativeTime(expense.createdAt, now)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-right font-medium tabular-nums">
                        {formatMoney(expense.amount, expense.currency)}
                        {expense.currency !== base && (
                          <span className="block text-sm font-normal text-gray-600 dark:text-gray-300">
                            ≈{" "}
                            {formatMoney(
                              convertToBase(expense.amount, expense.rateMicros),
                              base
                            )}
                          </span>
                        )}
                      </span>
                      {canMutate(expense.createdById) && (
                        <>
                          <Link
                            href={`/groups/${group.id}/expenses/${expense.id}/edit`}
                            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                          >
                            editează
                          </Link>
                          <form
                            action={deleteExpense.bind(
                              null,
                              group.id,
                              expense.id
                            )}
                          >
                            <ConfirmButton
                              message={
                                group.payments.length > 0
                                  ? `Ștergi cheltuiala „${expense.description}”? Grupul are plăți înregistrate — ștergerea poate face soldurile să nu mai reflecte ce s-a plătit deja.`
                                  : `Ștergi cheltuiala „${expense.description}”?`
                              }
                              className="text-sm font-medium text-red-700 transition hover:underline dark:text-red-400"
                              aria-label={`Șterge ${expense.description}`}
                            >
                              șterge
                            </ConfirmButton>
                          </form>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>

        <aside className="lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <section className="card flex flex-col gap-3 p-4">
            <h2 className="text-lg font-medium">Solduri</h2>
            {activeMembers.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Adaugă membri pentru a vedea soldurile.
              </p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {balances.map((b) => (
                  <li key={b.memberId} className="flex justify-between gap-3">
                    <span>{b.name}</span>
                    <span
                      className={
                        "shrink-0 tabular-nums " +
                        (b.net > 0
                          ? "text-green-700 dark:text-green-400"
                          : b.net < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-600 dark:text-gray-300")
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
                {settlement.map((t) => (
                  // Key by the debtor→creditor pair, not the array index: after
                  // one row is settled the list reshuffles, and an index key
                  // would leave a settled row's "achitat" state latched onto
                  // whatever transfer slid into its position.
                  <div
                    key={`${t.fromId}-${t.toId}`}
                    className="flex items-center justify-between gap-3 lg:flex-col lg:items-start lg:gap-2"
                  >
                    <p>
                      <span className="font-medium">{t.fromName}</span> îi dă{" "}
                      <span className="font-medium">{toDative(t.toName)}</span>{" "}
                      {formatMoney(t.amount, base)}
                    </p>
                    <QuickPayForm
                      groupId={group.id}
                      fromId={t.fromId}
                      toId={t.toId}
                      amount={baniToInput(t.amount)}
                      action={addPayment}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>

        <div className="flex flex-col gap-8 lg:col-start-1 lg:row-start-2">
          <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800 lg:border-t-0 lg:pt-0">
            <h2 className="text-lg font-medium">Plăți</h2>
            {group.payments.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Nicio plată înregistrată încă.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {group.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between card px-4 py-3 text-sm"
                  >
                    <span>
                      <span className="font-medium">{payment.from.name}</span> →{" "}
                      <span className="font-medium">{payment.to.name}</span>
                      <span className="ml-2 text-xs text-gray-600 dark:text-gray-300">
                        {formatRelativeTime(payment.createdAt, now)}
                      </span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium tabular-nums">
                        {formatMoney(payment.amount, base)}
                      </span>
                      {canMutate(payment.createdById) && (
                        <form
                          action={deletePayment.bind(
                            null,
                            group.id,
                            payment.id
                          )}
                        >
                          <ConfirmButton
                            message={`Ștergi plata ${payment.from.name} → ${payment.to.name} (${formatMoney(
                              payment.amount,
                              base
                            )})?`}
                            className="text-sm font-medium text-red-700 transition hover:underline dark:text-red-400"
                          >
                            șterge
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {activeMembers.length >= 2 && (
              <FeedbackForm
                action={addPayment}
                rowClassName="flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <input type="hidden" name="groupId" value={group.id} />
                <label className="flex flex-1 flex-col gap-1 text-sm">
                  De la
                  <select
                    name="fromId"
                    required
                    defaultValue=""
                    className="field"
                  >
                    <option value="" disabled>
                      —
                    </option>
                    {activeMembers.map((member) => (
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
                    className="field"
                  >
                    <option value="" disabled>
                      —
                    </option>
                    {activeMembers.map((member) => (
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
                    className="field"
                  />
                </label>
                <SubmitButton pendingLabel="Se adaugă…">Adaugă plată</SubmitButton>
              </FeedbackForm>
            )}
          </section>

          <GroupSummary
            expenses={expensesInBase}
            members={activeMembers}
            currency={base}
          />

          <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
            <h2 className="text-lg font-medium">Invită pe cineva</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
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
                      className="flex items-center justify-between gap-3 card px-4 py-3 text-sm"
                    >
                      <code className="truncate text-gray-600 dark:text-gray-300">
                        {url}
                      </code>
                      <div className="flex shrink-0 items-center gap-3">
                        <CopyButton
                          text={url}
                          className="text-gray-600 transition hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                        />
                        {isOwner && (
                          <form
                            action={revokeInvite.bind(
                              null,
                              group.id,
                              invite.token
                            )}
                          >
                            <SubmitButton
                              pendingLabel="…"
                              className="font-medium text-red-700 transition hover:underline disabled:opacity-50 dark:text-red-400"
                            >
                              revocă
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {!isOwner ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Doar owner-ul grupului poate genera linkuri de invitație.
              </p>
            ) : (
              <form action={boundCreateInvite}>
                <SubmitButton pendingLabel="Se generează…">
                  {group.invites.length > 0
                    ? "Prelungește linkul cu încă 7 zile"
                    : "Generează link de invitație"}
                </SubmitButton>
              </form>
            )}
          </section>

          <section className="flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
            <h2 className="text-lg font-medium">Export</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <a
                href={`/groups/${group.id}/export?type=expenses`}
                className="btn"
              >
                Cheltuieli (CSV)
              </a>
              <a
                href={`/groups/${group.id}/export?type=expenses&format=pdf`}
                className="btn"
              >
                Cheltuieli (PDF)
              </a>
              <a
                href={`/groups/${group.id}/export?type=balances`}
                className="btn"
              >
                Solduri (CSV)
              </a>
              <a
                href={`/groups/${group.id}/export?type=balances&format=pdf`}
                className="btn"
              >
                Solduri (PDF)
              </a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
