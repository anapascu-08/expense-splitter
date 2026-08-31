import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGroupAccess } from "@/lib/access";
import { computeBalances } from "@/lib/balances";
import { expensesToCsv, balancesToCsv } from "@/lib/csv";
import { expensesToPdf, balancesToPdf } from "@/lib/pdf";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "grup";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await requireGroupAccess(id);

  const type =
    request.nextUrl.searchParams.get("type") === "balances"
      ? "balances"
      : "expenses";
  const format =
    request.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "csv";

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: true,
      expenses: {
        orderBy: { createdAt: "asc" },
        include: { paidBy: true, participants: { include: { member: true } } },
      },
      payments: true,
    },
  });
  if (!group) return new Response("Not found", { status: 404 });

  let body: string | Blob;
  let kind: string;
  if (type === "balances") {
    const balances = computeBalances(
      group.members,
      group.expenses,
      group.payments
    );
    kind = "solduri";
    body =
      format === "pdf"
        ? new Blob([balancesToPdf(balances, `${group.name} - solduri`)])
        : `\uFEFF${balancesToCsv(balances)}`;
  } else {
    const expenses = group.expenses.map((e) => ({
      createdAt: e.createdAt,
      description: e.description,
      amount: e.amount,
      paidByName: e.paidBy.name,
      category: e.category,
      splitMode: e.splitMode,
      participantNames: e.participants.map((p) => p.member.name),
    }));
    kind = "cheltuieli";
    body =
      format === "pdf"
        ? new Blob([expensesToPdf(expenses, `${group.name} - cheltuieli`)])
        : `\uFEFF${expensesToCsv(expenses)}`;
  }

  const today = new Date().toISOString().slice(0, 10);
  const filename = `${slugify(group.name)}-${kind}-${today}.${format}`;
  // CSV: leading BOM (added above) so spreadsheets open UTF-8 diacritics.
  const contentType =
    format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8";

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
