"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  toBani,
  toBasisPoints,
  toShares,
  toRateMicros,
  RATE_SCALE,
  FULL_PERCENT_BP,
} from "@/lib/money";
import { isExpenseCategory } from "@/lib/categories";
import { isCurrency, DEFAULT_CURRENCY } from "@/lib/currencies";
import type { FormState } from "@/app/form-state";
import { requireUser } from "@/lib/auth";
import { requireGroupAccess } from "@/lib/access";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type ParticipantWeight = { memberId: string; weight: number };

// Read the split mode + per-participant weights from a form and validate them.
// Returns null when the input is invalid (the UI blocks these cases already).
function readSplit(
  formData: FormData,
  amount: number
): { splitMode: string; participants: ParticipantWeight[] } | null {
  const rawMode = String(formData.get("splitMode") ?? "EQUAL");
  const splitMode = ["EQUAL", "EXACT", "PERCENT", "SHARES"].includes(rawMode)
    ? rawMode
    : "EQUAL";
  const participantIds = formData.getAll("participantIds").map(String);
  if (participantIds.length === 0) return null;

  let participants: ParticipantWeight[];
  if (splitMode === "EXACT") {
    participants = participantIds.map((memberId) => ({
      memberId,
      weight: toBani(String(formData.get(`weight_${memberId}`) ?? "0")),
    }));
    const sum = participants.reduce((s, p) => s + p.weight, 0);
    if (participants.some((p) => p.weight < 0) || sum !== amount) return null;
  } else if (splitMode === "PERCENT") {
    participants = participantIds.map((memberId) => ({
      memberId,
      weight: toBasisPoints(String(formData.get(`weight_${memberId}`) ?? "0")),
    }));
    const sum = participants.reduce((s, p) => s + p.weight, 0);
    if (participants.some((p) => p.weight < 0) || sum !== FULL_PERCENT_BP) {
      return null;
    }
  } else if (splitMode === "SHARES") {
    participants = participantIds.map((memberId) => ({
      memberId,
      weight: toShares(String(formData.get(`weight_${memberId}`) ?? "0")),
    }));
    // Every participant needs at least one whole share; the amount is then
    // split proportionally (see splitAmount in lib/balances).
    if (participants.some((p) => !Number.isInteger(p.weight) || p.weight < 1)) {
      return null;
    }
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
  if (!name) return { error: "Dă un nume grupului." };

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

export async function updateGroup(groupId: string, formData: FormData) {
  const { role } = await requireGroupAccess(groupId);
  if (role !== "owner") return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.group.update({ where: { id: groupId }, data: { name } });
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
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
  groupId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireGroupAccess(groupId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Numele membrului e obligatoriu." };

  const clash = await prisma.member.findFirst({
    where: { groupId, name },
    select: { id: true },
  });
  if (clash) return { error: `„${name}” există deja în grup.` };

  await prisma.member.create({ data: { groupId, name } });
  revalidatePath(`/groups/${groupId}`);
  return { ok: `„${name}” a fost adăugat.` };
}

export async function updateMember(
  groupId: string,
  memberId: string,
  formData: FormData
) {
  await requireGroupAccess(groupId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  // Scope by groupId so a member can only be renamed from its own group.
  await prisma.member.updateMany({
    where: { id: memberId, groupId },
    data: { name },
  });
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}

export async function deleteMember(groupId: string, memberId: string) {
  await requireGroupAccess(groupId);
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
): { error: string } | ParsedExpense {
  const description = String(formData.get("description") ?? "").trim();
  const amount = toBani(String(formData.get("amount") ?? "0"));
  const paidById = String(formData.get("paidById") ?? "");

  if (!description) return { error: "Adaugă o descriere." };
  if (amount <= 0) return { error: "Suma trebuie să fie mai mare ca zero." };
  if (!paidById) return { error: "Alege cine a plătit." };

  const split = readSplit(formData, amount);
  if (!split) return { error: "Împărțirea nu se potrivește cu suma." };

  const money = readCurrency(formData, baseCurrency);
  if (!money) return { error: "Pune un curs valutar pozitiv." };

  return { description, amount, paidById, split, money };
}

export async function addExpense(
  groupId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireGroupAccess(groupId);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { baseCurrency: true },
  });
  if (!group) return { error: "Grupul nu există." };

  const parsed = readExpense(formData, group.baseCurrency);
  if ("error" in parsed) return parsed;

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
  await requireGroupAccess(groupId);

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, groupId },
    select: { id: true, group: { select: { baseCurrency: true } } },
  });
  if (!expense) return { error: "Cheltuiala nu mai există." };

  const parsed = readExpense(formData, expense.group.baseCurrency);
  if ("error" in parsed) return parsed;
  const { description, amount, paidById, split, money } = parsed;

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
  await requireGroupAccess(groupId);
  await prisma.expense.deleteMany({ where: { id: expenseId, groupId } });
  revalidatePath(`/groups/${groupId}`);
}

export async function addPayment(groupId: string, formData: FormData) {
  await requireGroupAccess(groupId);
  const fromId = String(formData.get("fromId") ?? "");
  const toId = String(formData.get("toId") ?? "");
  const amount = toBani(String(formData.get("amount") ?? "0"));

  if (!fromId || !toId || fromId === toId || amount <= 0) return;

  // Both parties must belong to this group.
  const membersInGroup = await prisma.member.count({
    where: { groupId, id: { in: [fromId, toId] } },
  });
  if (membersInGroup !== 2) return;

  await prisma.payment.create({
    data: { groupId, fromId, toId, amount },
  });
  revalidatePath(`/groups/${groupId}`);
}

export async function deletePayment(groupId: string, paymentId: string) {
  await requireGroupAccess(groupId);
  await prisma.payment.deleteMany({ where: { id: paymentId, groupId } });
  revalidatePath(`/groups/${groupId}`);
}

// --- Invites -----------------------------------------------------------

export async function createInvite(groupId: string) {
  const { user } = await requireGroupAccess(groupId);
  await prisma.groupInvite.create({
    data: {
      groupId,
      createdById: user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
  revalidatePath(`/groups/${groupId}`);
}

export async function revokeInvite(groupId: string, token: string) {
  await requireGroupAccess(groupId);
  await prisma.groupInvite.updateMany({
    where: { token, groupId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/groups/${groupId}`);
}

export async function acceptInvite(token: string) {
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
  redirect(`/groups/${invite.groupId}`);
}
