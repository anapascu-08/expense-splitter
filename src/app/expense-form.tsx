"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatBani } from "@/lib/money";
import { splitAmount } from "@/lib/balances";
import { EXPENSE_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";

export type SplitMode = "EQUAL" | "EXACT" | "PERCENT" | "SHARES";

export type ExpenseFormDefaults = {
  description: string;
  amount: string;
  paidById: string;
  // "" = no category; otherwise one of the slugs in lib/categories.
  category: string;
  splitMode: SplitMode;
  participantIds: string[];
  // memberId -> input string; RON for EXACT, percent for PERCENT
  weights: Record<string, string>;
};

type Member = { id: string; name: string };

type Props = {
  members: Member[];
  action: (formData: FormData) => void;
  submitLabel: string;
  cancelHref?: string;
  defaults?: ExpenseFormDefaults;
};

const inputClass =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent";

function parseNum(value: string): number {
  const n = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const MODE_LABELS: Record<SplitMode, string> = {
  EQUAL: "În mod egal",
  EXACT: "Sume exacte (RON)",
  PERCENT: "Procente (%)",
  SHARES: "Cote (shares)",
};

const WEIGHT_SUFFIX: Record<Exclude<SplitMode, "EQUAL">, string> = {
  EXACT: "RON",
  PERCENT: "%",
  SHARES: "cote",
};

export function ExpenseForm({
  members,
  action,
  submitLabel,
  cancelHref,
  defaults,
}: Props) {
  const [description, setDescription] = useState(defaults?.description ?? "");
  const [amount, setAmount] = useState(defaults?.amount ?? "");
  const [paidById, setPaidById] = useState(
    defaults?.paidById ?? members[0]?.id ?? ""
  );
  const [category, setCategory] = useState(defaults?.category ?? "");
  const [splitMode, setSplitMode] = useState<SplitMode>(
    defaults?.splitMode ?? "EQUAL"
  );
  const [checked, setChecked] = useState<Set<string>>(
    () =>
      new Set(
        defaults?.participantIds ?? members.map((m) => m.id)
      )
  );
  const [weights, setWeights] = useState<Record<string, string>>(
    defaults?.weights ?? {}
  );

  const amountBani = Math.round(parseNum(amount) * 100);
  const participants = members.filter((m) => checked.has(m.id));

  const allocation = useMemo(() => {
    if (splitMode === "EQUAL" || splitMode === "SHARES") return null;
    const unit = splitMode === "PERCENT" ? 10000 : amountBani;
    const allocated = participants.reduce(
      (sum, m) => sum + Math.round(parseNum(weights[m.id] ?? "") * 100),
      0
    );
    return { unit, allocated, diff: allocated - unit };
  }, [splitMode, participants, weights, amountBani]);

  // SHARES has no target sum — any positive total works. Show a preview of the
  // per-share value instead of a match/mismatch indicator. Every participant
  // still needs at least one whole share (matches the server-side guard).
  const shareCounts = participants.map((m) =>
    Math.round(parseNum(weights[m.id] ?? ""))
  );
  const sharesTotal =
    splitMode === "SHARES"
      ? shareCounts.reduce((sum, w) => sum + Math.max(0, w), 0)
      : 0;
  const sharesAllValid =
    splitMode === "SHARES" &&
    participants.length > 0 &&
    shareCounts.every((w) => w >= 1);

  const mismatch =
    (allocation !== null &&
      (allocation.diff !== 0 || (splitMode === "EXACT" && amountBani <= 0))) ||
    (splitMode === "SHARES" && (!sharesAllValid || amountBani <= 0));

  // Per-participant preview for SHARES: amount split proportionally to shares.
  const sharesPreview =
    sharesAllValid && amountBani > 0
      ? splitAmount(amountBani, shareCounts)
      : null;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        type="text"
        name="description"
        placeholder="Descriere (ex: cină)"
        required
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={inputClass}
      />
      <input
        type="text"
        inputMode="decimal"
        name="amount"
        placeholder="Sumă (RON)"
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className={inputClass}
      />

      <label className="flex flex-col gap-1 text-sm">
        Plătit de
        <select
          name="paidById"
          required
          value={paidById}
          onChange={(e) => setPaidById(e.target.value)}
          className={inputClass}
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Categorie
        <select
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
        >
          <option value="">— fără categorie —</option>
          {EXPENSE_CATEGORIES.map((slug) => (
            <option key={slug} value={slug}>
              {CATEGORY_LABELS[slug]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Împărțire
        <select
          name="splitMode"
          value={splitMode}
          onChange={(e) => setSplitMode(e.target.value as SplitMode)}
          className={inputClass}
        >
          {(Object.keys(MODE_LABELS) as SplitMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">
          {splitMode === "EQUAL" ? "Împărțit între" : "Participanți"}
        </legend>
        {members.map((member) => {
          const isChecked = checked.has(member.id);
          return (
            <div key={member.id} className="flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  name="participantIds"
                  value={member.id}
                  checked={isChecked}
                  onChange={() => toggle(member.id)}
                />
                {member.name}
              </label>
              {splitMode !== "EQUAL" && isChecked && (
                <span className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode={splitMode === "SHARES" ? "numeric" : "decimal"}
                    name={`weight_${member.id}`}
                    value={weights[member.id] ?? ""}
                    onChange={(e) =>
                      setWeights((prev) => ({
                        ...prev,
                        [member.id]: e.target.value,
                      }))
                    }
                    className={`${inputClass} w-24 text-right`}
                    placeholder={splitMode === "SHARES" ? "1" : "0"}
                  />
                  <span className="text-gray-500 dark:text-gray-400">
                    {WEIGHT_SUFFIX[splitMode]}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </fieldset>

      {allocation !== null && (
        <p
          className={
            mismatch
              ? "text-sm text-red-600 dark:text-red-400"
              : "text-sm text-green-600 dark:text-green-400"
          }
        >
          {splitMode === "PERCENT"
            ? `Alocat ${(allocation.allocated / 100).toFixed(2)}% / 100.00%`
            : `Alocat ${formatBani(allocation.allocated)} / ${formatBani(
                Math.max(amountBani, 0)
              )} RON`}
          {allocation.diff === 0
            ? " ✓"
            : allocation.diff > 0
              ? splitMode === "PERCENT"
                ? ` — depășit cu ${(allocation.diff / 100).toFixed(2)}%`
                : ` — depășit cu ${formatBani(allocation.diff)} RON`
              : splitMode === "PERCENT"
                ? ` — mai rămâne ${(-allocation.diff / 100).toFixed(2)}%`
                : ` — mai rămâne ${formatBani(-allocation.diff)} RON`}
        </p>
      )}

      {splitMode === "SHARES" && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {sharesAllValid
            ? `${sharesTotal} ${sharesTotal === 1 ? "cotă" : "cote"} în total`
            : "Pune cel puțin o cotă (număr întreg) pentru fiecare participant."}
          {sharesPreview && (
            <>
              {" — "}
              {participants
                .map((m, i) => `${m.name}: ${formatBani(sharesPreview[i])}`)
                .join(" · ")}{" "}
              RON
            </>
          )}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          disabled={mismatch || participants.length === 0}
        >
          {submitLabel}
        </button>
        {cancelHref && (
          <Link
            href={cancelHref}
            className="text-sm text-gray-500 hover:underline dark:text-gray-400"
          >
            Anulează
          </Link>
        )}
      </div>
    </form>
  );
}
