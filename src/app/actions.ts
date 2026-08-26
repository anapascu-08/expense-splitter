"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBani } from "@/lib/money";

export async function createGroup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const group = await prisma.group.create({ data: { name } });
  redirect(`/groups/${group.id}`);
}

export async function addMember(groupId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.member.create({ data: { groupId, name } });
  revalidatePath(`/groups/${groupId}`);
}

export async function addExpense(groupId: string, formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const amount = toBani(String(formData.get("amount") ?? "0"));
  const paidById = String(formData.get("paidById") ?? "");
  const participantIds = formData.getAll("participantIds").map(String);

  if (!description || amount <= 0 || !paidById || participantIds.length === 0) {
    return;
  }

  await prisma.expense.create({
    data: {
      groupId,
      description,
      amount,
      paidById,
      participants: {
        create: participantIds.map((memberId) => ({ memberId })),
      },
    },
  });

  revalidatePath(`/groups/${groupId}`);
}

export async function deleteExpense(groupId: string, expenseId: string) {
  await prisma.expense.delete({ where: { id: expenseId } });
  revalidatePath(`/groups/${groupId}`);
}
