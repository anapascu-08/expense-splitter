"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  toBani,
  toBasisPoints,
  toShares,
  toRateMicros,
  convertToBase,
  RATE_SCALE,
  FULL_PERCENT_BP,
} from "@/lib/money";
import { computeBalances } from "@/lib/balances";
import { isExpenseCategory } from "@/lib/categories";
import { isCurrency, DEFAULT_CURRENCY } from "@/lib/currencies";
import type { FormState } from "@/app/form-state";
import { requireUser } from "@/lib/auth";
import { requireGroupAccess } from "@/lib/access";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type ParticipantWeight = { memberId: string; weight: number };

// Read the split mode + per-participant weights from a form and validate them.
// Returns a specific error message (not just "invalid") so the form can point
// at what's wrong; duplicate participant ids are collapsed so they can't hit
// the ExpenseParticipant composite primary key.
function readSplit(
  formData: FormData,
  amount: number
): { error: string; field?: string } | {
  splitMode: string;
  participants: ParticipantWeight[];
} {
  const rawMode = String(formData.get("splitMode") ?? "");
  if (!["EQUAL", "EXACT", "PERCENT", "SHARES"].includes(rawMode))
    return {
      error: "Alege cum se împarte cheltuiala.",
      field: "splitMode",
    };
  const splitMode = rawMode;
  const participantIds = [
    ...new Set(formData.getAll("participantIds").map(String)),
  ];
  if (participantIds.length === 0)
    return { error: "Alege cel puțin un participant." };

  let participants: ParticipantWeight[];
  if (splitMode === "EXACT") {
    participants = participantIds.map((memberId) => ({
      memberId,
      weight: toBani(String(formData.get(`weight_${memberId}`) ?? "0")),
    }));
    const sum = participants.reduce((s, p) => s + p.weight, 0);
    if (participants.some((p) => p.weight < 0) || sum !== amount)
      return {
        error: "Sumele exacte trebuie să adune fix suma cheltuielii.",
      };
  } else if (splitMode === "PERCENT") {
    participants = participantIds.map((memberId) => ({
      memberId,
      weight: toBasisPoints(String(formData.get(`weight_${memberId}`) ?? "0")),
    }));
    const sum = participants.reduce((s, p) => s + p.weight, 0);
    if (participants.some((p) => p.weight < 0) || sum !== FULL_PERCENT_BP)
      return { error: "Procentele trebuie să adune fix 100%." };
  } else if (splitMode === "SHARES") {
    participants = participantIds.map((memberId) => ({
      memberId,
      weight: toShares(String(formData.get(`weight_${memberId}`) ?? "0")),
    }));
    // Every participant needs at least one whole share; the amount is then
    // split proportionally (see splitAmount in lib/balances).
    if (participants.some((p) => !Number.isInteger(p.weight) || p.weight < 1))
      return {
        error: "Fiecare participant are nevoie de cel puțin o cotă întreagă.",
      };
  } else {
    participants = participantIds.map((memberId) => ({ memberId, weight: 1 }));
  }

  return { splitMode, participants };
}

// Read an optional expense category from the form. Unknown/blank -> null.
function readCategory(formData: FormData): string | null {
  const raw = String(formData.get("category") ?? "").trim();
  return isExpenseCategory(raw) ? raw : null;
}

// Read the expense currency + its exchange rate to the group's base currency.
// Same currency as the group -> rate is exactly 1. A foreign currency needs a
// positive rate; anything else is rejected (null), matching the form's guard.
function readCurrency(
  formData: FormData,
  baseCurrency: string
): { currency: string; rateMicros: number } | null {
  const raw = String(formData.get("currency") ?? "");
  const currency = isCurrency(raw) ? raw : baseCurrency;
  if (currency === baseCurrency) return { currency, rateMicros: RATE_SCALE };

  const rateMicros = toRateMicros(String(formData.get("rate") ?? ""));
  if (rateMicros <= 0) return null;
  return { currency, rateMicros };
}

export async function createGroup(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Dă un nume grupului.", field: "name" };

  const rawCurrency = String(formData.get("baseCurrency") ?? "");
  const baseCurrency = isCurrency(rawCurrency) ? rawCurrency : DEFAULT_CURRENCY;

  const group = await prisma.group.create({
    data: {
      name,
      baseCurrency,
      ownerId: user.id,
      groupMembers: { create: { userId: user.id, role: "owner" } },
    },
  });
  redirect(`/groups/${group.id}`);
}

export async function updateGroup(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  // groupId via hidden field, not a bound arg — see addMember. Needed here now
  // that this returns { ok } (revalidatePath re-renders the page, which would
  // change a bound action's identity and drop the message).
  const groupId = String(formData.get("groupId") ?? "");
  const { role } = await requireGroupAccess(groupId);
  if (role !== "owner")
    return { error: "Doar owner-ul poate redenumi grupul." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name)
    return { error: "Numele grupului nu poate fi gol.", field: "name" };

  await prisma.group.update({ where: { id: groupId }, data: { name } });
  revalidatePath(`/groups/${groupId}`);
  // No redirect: the spec wants a discreet, self-dismissing success note.
  return { ok: "Numele grupului a fost salvat." };
}

export async function deleteGroup(groupId: string) {
  const { role } = await requireGroupAccess(groupId);
  if (role !== "owner") return;

  // Members are Restrict-referenced by Expense.paidBy and Payment.from/to, so a
  // plain group.delete() cascade can trip those constraints depending on the
  // order the DB unwinds them. Clear the blockers first, then members, then the
  // group (which cascades the remaining GroupMember / GroupInvite rows).
  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { groupId } }),
    prisma.expense.deleteMany({ where: { groupId } }),
    prisma.member.deleteMany({ where: { groupId } }),
    prisma.group.delete({ where: { id: groupId } }),
  ]);

  revalidatePath("/");
  redirect("/");
}

export async function addMember(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  // groupId comes through a hidden field, not a bound arg: a per-render
  // action.bind() breaks the useActionState feedback on the group page (its
  // identity changes when revalidatePath re-renders). Same as `login`.
  const groupId = String(formData.get("groupId") ?? "");
  await requireGroupAccess(groupId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name)
    return { error: "Numele membrului e obligatoriu.", field: "name" };

  const clash = await prisma.member.findFirst({
    // Case-insensitive: "Ana" and "ana" as two members read as a bug in the
    // balances list.
    where: { groupId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash)
    return { error: `„${name}” există deja în grup.`, field: "name" };

  await prisma.member.create({ data: { groupId, name } });
  revalidatePath(`/groups/${groupId}`);
  return { ok: `„${name}” a fost adăugat.` };
}

export async function updateMember(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  // groupId + memberId via hidden fields, not bound args — see updateGroup.
  const groupId = String(formData.get("groupId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  await requireGroupAccess(groupId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name)
    return { error: "Numele membrului nu poate fi gol.", field: "name" };

  const clash = await prisma.member.findFirst({
    where: {
      groupId,
      name: { equals: name, mode: "insensitive" },
      id: { not: memberId },
    },
    select: { id: true },
  });
  if (clash)
    return { error: `„${name}” există deja în grup.`, field: "name" };

  // Scope by groupId so a member can only be renamed from its own group.
  await prisma.member.updateMany({
    where: { id: memberId, groupId },
    data: { name },
  });
  revalidatePath(`/groups/${groupId}`);
  return { ok: "Numele membrului a fost salvat." };
}

export async function deleteMember(groupId: string, memberId: string) {
  const { role } = await requireGroupAccess(groupId);
  if (role !== "owner") return;
  // Block deletion while the member is tied to expenses: as payer the DB would
  // reject it (paidBy is onDelete: Restrict), and as a participant a cascade
  // delete would silently re-split past expenses. The UI hides the button in
  // this case; this is the matching server-side guard.
  const involved = await prisma.member.findFirst({
    where: {
      id: memberId,
      groupId,
      OR: [
        { paidExpenses: { some: {} } },
        { shares: { some: {} } },
        { paymentsSent: { some: {} } },
        { paymentsReceived: { some: {} } },
      ],
    },
    select: { id: true },
  });
  if (involved) return;

  await prisma.member.deleteMany({ where: { id: memberId, groupId } });
  revalidatePath(`/groups/${groupId}`);
}

// Undo a claim: detach the account from a Member slot so the name is free to be
// claimed again, and drop that account's group access so they land back on the
// invite screen and can pick the right name (or not return). Owner-only. The
// owner's own slot is left alone — unlinking it would lock them out of their
// own group.
export async function unlinkMember(groupId: string, memberId: string) {
  const { role } = await requireGroupAccess(groupId);
  if (role !== "owner") return;

  const member = await prisma.member.findFirst({
    where: { id: memberId, groupId },
    select: { userId: true, group: { select: { ownerId: true } } },
  });
  if (!member?.userId || member.userId === member.group.ownerId) return;

  const { userId } = member;
  await prisma.$transaction([
    prisma.member.updateMany({
      where: { id: memberId, groupId },
      data: { userId: null },
    }),
    prisma.groupMember.deleteMany({ where: { groupId, userId } }),
  ]);
  revalidatePath(`/groups/${groupId}`);
}

// Retire a settled member: keeps every past expense/payment that names them,
// but drops them from the pickers and the balances list. Owner-only, and only
// when their net balance is exactly zero — archiving someone still owed money
// (or owing) would hide a live debt.
export async function archiveMember(groupId: string, memberId: string) {
  const { role } = await requireGroupAccess(groupId);
  if (role !== "owner") return;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      members: { select: { id: true, name: true } },
      expenses: {
        select: {
          amount: true,
          rateMicros: true,
          paidById: true,
          participants: { select: { memberId: true, weight: true } },
        },
      },
      payments: { select: { amount: true, fromId: true, toId: true } },
    },
  });
  if (!group || !group.members.some((m) => m.id === memberId)) return;

  const expensesInBase = group.expenses.map((e) => ({
    ...e,
    amount: convertToBase(e.amount, e.rateMicros),
  }));
  const balances = computeBalances(
    group.members,
    expensesInBase,
    group.payments
  );
  const net = balances.find((b) => b.memberId === memberId)?.net ?? 0;
  if (net !== 0) return;

  await prisma.member.updateMany({
    where: { id: memberId, groupId },
    data: { archivedAt: new Date() },
  });
  revalidatePath(`/groups/${groupId}`);
}

export async function unarchiveMember(groupId: string, memberId: string) {
  const { role } = await requireGroupAccess(groupId);
  if (role !== "owner") return;
  await prisma.member.updateMany({
    where: { id: memberId, groupId },
    data: { archivedAt: null },
  });
  revalidatePath(`/groups/${groupId}`);
}

type ParsedExpense = {
  description: string;
  amount: number;
  paidById: string;
  split: { splitMode: string; participants: ParticipantWeight[] };
  money: { currency: string; rateMicros: number };
};

// Shared field validation for the add / edit expense forms. Returns an error
// string for the first problem, or the parsed values on success.
function readExpense(
  formData: FormData,
  baseCurrency: string
): { error: string; field?: string } | ParsedExpense {
  const description = String(formData.get("description") ?? "").trim();
  const amount = toBani(String(formData.get("amount") ?? "0"));
  const paidById = String(formData.get("paidById") ?? "");

  if (!description)
    return { error: "Adaugă o descriere.", field: "description" };
  if (amount <= 0)
    return { error: "Suma trebuie să fie mai mare ca zero.", field: "amount" };
  if (!paidById) return { error: "Alege cine a plătit.", field: "paidById" };

  const split = readSplit(formData, amount);
  if ("error" in split) return split;

  const money = readCurrency(formData, baseCurrency);
  if (!money) return { error: "Pune un curs valutar pozitiv.", field: "rate" };

  return { description, amount, paidById, split, money };
}

// An owner may edit/delete anything in the group; a plain member only rows
// they created. Rows with no recorded creator (created before this was
// tracked) are owner-only.
function canMutate(
  role: string,
  createdById: string | null,
  userId: string
): boolean {
  return role === "owner" || (createdById !== null && createdById === userId);
}

// Every id in an expense (payer + participants) must be an active member of the
// group. Guards against a member deleted/archived while the form was open (would
// be an unhandled FK error, or a new entry pinned to a retired member) and
// against a hand-built request linking a foreign member (computeBalances ignores
// it, so balances would stop summing to zero).
async function membersBelong(
  groupId: string,
  ids: string[]
): Promise<boolean> {
  const unique = [...new Set(ids)];
  const found = await prisma.member.count({
    where: { groupId, id: { in: unique }, archivedAt: null },
  });
  return found === unique.length;
}

export async function addExpense(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  // groupId via hidden field, not a bound arg — see addMember.
  const groupId = String(formData.get("groupId") ?? "");
  const { user } = await requireGroupAccess(groupId);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { baseCurrency: true },
  });
  if (!group) return { error: "Grupul nu există." };

  const parsed = readExpense(formData, group.baseCurrency);
  if ("error" in parsed) return parsed;

  const ok = await membersBelong(groupId, [
    parsed.paidById,
    ...parsed.split.participants.map((p) => p.memberId),
  ]);
  if (!ok)
    return { error: "Unii membri nu mai fac parte din grup. Reîncarcă pagina." };

  await prisma.expense.create({
    data: {
      groupId,
      description: parsed.description,
      amount: parsed.amount,
      paidById: parsed.paidById,
      currency: parsed.money.currency,
      rateMicros: parsed.money.rateMicros,
      category: readCategory(formData),
      splitMode: parsed.split.splitMode,
      createdById: user.id,
      participants: { create: parsed.split.participants },
    },
  });

  revalidatePath(`/groups/${groupId}`);
  return { ok: "Cheltuială adăugată." };
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, role } = await requireGroupAccess(groupId);

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, groupId },
    select: {
      id: true,
      createdById: true,
      group: { select: { baseCurrency: true } },
    },
  });
  if (!expense) return { error: "Cheltuiala nu mai există." };
  if (!canMutate(role, expense.createdById, user.id))
    return { error: "Doar cine a adăugat cheltuiala sau owner-ul o pot edita." };

  const parsed = readExpense(formData, expense.group.baseCurrency);
  if ("error" in parsed) return parsed;
  const { description, amount, paidById, split, money } = parsed;

  const ok = await membersBelong(groupId, [
    paidById,
    ...split.participants.map((p) => p.memberId),
  ]);
  if (!ok)
    return { error: "Unii membri nu mai fac parte din grup. Reîncarcă pagina." };

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      description,
      amount,
      paidById,
      currency: money.currency,
      rateMicros: money.rateMicros,
      category: readCategory(formData),
      splitMode: split.splitMode,
      participants: {
        deleteMany: {},
        create: split.participants,
      },
    },
  });

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}

export async function deleteExpense(groupId: string, expenseId: string) {
  const { user, role } = await requireGroupAccess(groupId);
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, groupId },
    select: { createdById: true },
  });
  if (!expense || !canMutate(role, expense.createdById, user.id)) return;
  await prisma.expense.deleteMany({ where: { id: expenseId, groupId } });
  revalidatePath(`/groups/${groupId}`);
}

export async function addPayment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  // groupId via hidden field, not a bound arg — see addMember.
  const groupId = String(formData.get("groupId") ?? "");
  const { user } = await requireGroupAccess(groupId);
  const fromId = String(formData.get("fromId") ?? "");
  const toId = String(formData.get("toId") ?? "");
  const amount = toBani(String(formData.get("amount") ?? "0"));

  if (!fromId || !toId)
    return {
      error: "Alege cine plătește și cui.",
      field: ["fromId", "toId"],
    };
  if (fromId === toId)
    return {
      error: "Plătitorul și beneficiarul trebuie să fie diferiți.",
      field: ["fromId", "toId"],
    };
  if (amount <= 0)
    return { error: "Suma trebuie să fie mai mare ca zero.", field: "amount" };

  // Both parties must be active members of this group.
  const membersInGroup = await prisma.member.count({
    where: { groupId, id: { in: [fromId, toId] }, archivedAt: null },
  });
  if (membersInGroup !== 2)
    return {
      error: "Membru invalid pentru acest grup.",
      field: ["fromId", "toId"],
    };

  await prisma.payment.create({
    data: { groupId, fromId, toId, amount, createdById: user.id },
  });
  revalidatePath(`/groups/${groupId}`);
  return { ok: "Plată înregistrată." };
}

export async function deletePayment(groupId: string, paymentId: string) {
  const { user, role } = await requireGroupAccess(groupId);
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, groupId },
    select: { createdById: true },
  });
  if (!payment || !canMutate(role, payment.createdById, user.id)) return;
  await prisma.payment.deleteMany({ where: { id: paymentId, groupId } });
  revalidatePath(`/groups/${groupId}`);
}

// --- Invites -----------------------------------------------------------

export async function createInvite(groupId: string) {
  const { user, role } = await requireGroupAccess(groupId);
  if (role !== "owner") return;

  // Invite links are meant to be reusable (see spec). Keep one active link per
  // group: if there's already a live one, just extend its life instead of
  // minting a new token every click.
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const active = await prisma.groupInvite.findFirst({
    where: { groupId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
  if (active) {
    await prisma.groupInvite.update({
      where: { token: active.token },
      data: { expiresAt },
    });
  } else {
    await prisma.groupInvite.create({
      data: { groupId, createdById: user.id, expiresAt },
    });
  }
  revalidatePath(`/groups/${groupId}`);
}

export async function revokeInvite(groupId: string, token: string) {
  const { role } = await requireGroupAccess(groupId);
  if (role !== "owner") return;
  await prisma.groupInvite.updateMany({
    where: { token, groupId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/groups/${groupId}`);
}

export async function acceptInvite(token: string, formData?: FormData) {
  const user = await requireUser();

  const invite = await prisma.groupInvite.findUnique({ where: { token } });
  if (
    !invite ||
    invite.revokedAt !== null ||
    invite.expiresAt.getTime() < Date.now()
  ) {
    return;
  }

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: invite.groupId, userId: user.id } },
    create: { groupId: invite.groupId, userId: user.id, role: "member" },
    update: {},
  });

  // Give the new arrival a Member slot so they show up in the balances straight
  // away. They either claim an unclaimed slot someone already typed in for them
  // (`claimMemberId` names it) or get a fresh one. Skip if they already have a
  // slot here; the @@unique([groupId, userId]) covers a concurrent race.
  const hasSlot = await prisma.member.findFirst({
    where: { groupId: invite.groupId, userId: user.id },
    select: { id: true },
  });
  if (!hasSlot) {
    const claimId = formData?.get("claimMemberId");
    // Only claim a still-unclaimed slot in this group; if it was taken between
    // the invite page rendering and this submit, fall through to a fresh slot.
    const claimed =
      typeof claimId === "string" && claimId && claimId !== "new"
        ? (
            await prisma.member.updateMany({
              where: { id: claimId, groupId: invite.groupId, userId: null },
              data: { userId: user.id },
            })
          ).count === 1
        : false;

    if (!claimed) {
      try {
        await prisma.member.create({
          data: { groupId: invite.groupId, name: user.name, userId: user.id },
        });
      } catch (err) {
        if (
          !(
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          )
        ) {
          throw err;
        }
      }
    }
  }

  redirect(`/groups/${invite.groupId}`);
}
