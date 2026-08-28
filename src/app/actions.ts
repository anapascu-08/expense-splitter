"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBani, toBasisPoints, FULL_PERCENT_BP } from "@/lib/money";

type ParticipantWeight = { memberId: string; weight: number };

// Read the split mode + per-participant weights from a form and validate them.
// Returns null when the input is invalid (the UI blocks these cases already).
function readSplit(
  formData: FormData,
  amount: number
): { splitMode: string; participants: ParticipantWeight[] } | null {
  const rawMode = String(formData.get("splitMode") ?? "EQUAL");
  const splitMode = ["EQUAL", "EXACT", "PERCENT"].includes(rawMode)
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
  } else {
    participants = participantIds.map((memberId) => ({ memberId, weight: 1 }));
  }

  return { splitMode, participants };
}

export async function createGroup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const group = await prisma.group.create({ data: { name } });
  redirect(`/groups/${group.id}`);
}

export async function updateGroup(groupId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.group.update({ where: { id: groupId }, data: { name } });
  revalidatePath(`/groups/${groupId}`);
}

export async function deleteGroup(groupId: string) {
  // Cascade deletes members, expenses and participant rows (see schema).
  await prisma.group.delete({ where: { id: groupId } });
  revalidatePath("/");
  redirect("/");
}

export async function addMember(groupId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.member.create({ data: { groupId, name } });
  revalidatePath(`/groups/${groupId}`);
}

export async function updateMember(
  groupId: string,
  memberId: string,
  formData: FormData
) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  // Scope by groupId so a member can only be renamed from its own group.
  await prisma.member.updateMany({
    where: { id: memberId, groupId },
    data: { name },
  });
  revalidatePath(`/groups/${groupId}`);
}

export async function deleteMember(groupId: string, memberId: string) {
  // Block deletion while the member is tied to expenses: as payer the DB would
  // reject it (paidBy is onDelete: Restrict), and as a participant a cascade
  // delete would silently re-split past expenses. The UI hides the button in
  // this case; this is the matching server-side guard.
  const involved = await prisma.member.findFirst({
    where: {
      id: memberId,
      groupId,
      OR: [{ paidExpenses: { some: {} } }, { shares: { some: {} } }],
    },
    select: { id: true },
  });
  if (involved) return;

  await prisma.member.deleteMany({ where: { id: memberId, groupId } });
  revalidatePath(`/groups/${groupId}`);
}

export async function addExpense(groupId: string, formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const amount = toBani(String(formData.get("amount") ?? "0"));
  const paidById = String(formData.get("paidById") ?? "");

  if (!description || amount <= 0 || !paidById) return;
  const split = readSplit(formData, amount);
  if (!split) return;

  await prisma.expense.create({
    data: {
      groupId,
      description,
      amount,
      paidById,
      splitMode: split.splitMode,
      participants: { create: split.participants },
    },
  });

  revalidatePath(`/groups/${groupId}`);
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  formData: FormData
) {
  const description = String(formData.get("description") ?? "").trim();
  const amount = toBani(String(formData.get("amount") ?? "0"));
  const paidById = String(formData.get("paidById") ?? "");

  if (!description || amount <= 0 || !paidById) return;
  const split = readSplit(formData, amount);
  if (!split) return;

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, groupId },
    select: { id: true },
  });
  if (!expense) return;

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      description,
      amount,
      paidById,
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
  await prisma.expense.deleteMany({ where: { id: expenseId, groupId } });
  revalidatePath(`/groups/${groupId}`);
}
