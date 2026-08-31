import { baniToInput } from "@/lib/money";
import { categoryLabel } from "@/lib/categories";
import type { MemberBalance } from "@/lib/balances";
import { SPLIT_MODE_LABEL, isoDate, type ExportExpense } from "@/lib/csv";

// A deliberately tiny PDF writer - no dependency, same spirit as csv.ts.
// It only does what an expense report needs: one landscape A4 page (or more,
// paginated) with a title and a single fixed-column table, drawn with the
// standard Helvetica fonts (no embedding). Output is deterministic for a
// given input so it can be pinned in tests.

export type PdfColumn = {
  header: string;
  width: number; // points
  align?: "left" | "right";
};

export type TablePdfOptions = {
  title: string;
  columns: PdfColumn[];
  rows: string[][];
};

const PAGE_W = 842; // A4 landscape, points
const PAGE_H = 595;
const MARGIN = 40;
const ROW_STEP = 15;
const ROWS_PER_PAGE = 30;

// Helvetica AFM advance widths (units per 1000 em) for ASCII 0x20..0x7E.
// Used only to truncate over-long cells; approximate for anything outside.
const HELV_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

function charWidth(code: number): number {
  if (code >= 0x20 && code <= 0x7e) return HELV_WIDTHS[code - 0x20];
  return 556;
}

function textWidth(s: string, size: number): number {
  let w = 0;
  for (let i = 0; i < s.length; i++) w += charWidth(s.charCodeAt(i));
  return (w * size) / 1000;
}

// WinAnsi (CP1252) covers Latin-1 directly in 0xA0..0xFF, so a-circumflex /
// i-circumflex and most Western-European names pass through untouched.
// Characters it lacks - chiefly Romanian a-breve / s-comma / t-comma and
// curly punctuation - are folded to a plain equivalent.
const SUBST: Record<string, string> = {
  "ă": "a", "Ă": "A",
  "ș": "s", "Ș": "S", "ş": "s", "Ş": "S",
  "ț": "t", "Ț": "T", "ţ": "t", "Ţ": "T",
  "‘": "'", "’": "'", "“": '"', "”": '"',
  "–": "-", "—": "-", "…": "...",
};

function encodeWinAnsi(s: string): string {
  let out = "";
  for (const ch of s) {
    const sub = SUBST[ch];
    if (sub !== undefined) {
      out += sub;
      continue;
    }
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff)) {
      out += ch;
      continue;
    }
    const stripped = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    out += stripped && stripped.codePointAt(0)! <= 0x7e ? stripped : "?";
  }
  return out;
}

function escapePdfText(s: string): string {
  return s.replace(/[\\()\r\n\t]/g, (c) =>
    c === "\\"
      ? "\\\\"
      : c === "("
        ? "\\("
        : c === ")"
          ? "\\)"
          : c === "\r"
            ? "\\r"
            : c === "\n"
              ? "\\n"
              : "\\t"
  );
}

function fitText(s: string, size: number, maxWidth: number): string {
  if (textWidth(s, size) <= maxWidth) return s;
  let out = s;
  while (out.length > 0 && textWidth(out + "...", size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "...";
}

function round(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

function textOp(
  font: "F1" | "F2",
  size: number,
  x: number,
  y: number,
  raw: string,
  width: number,
  align: "left" | "right"
): string {
  const shown = fitText(encodeWinAnsi(raw), size, width - 4);
  const tx = align === "right" ? x + width - 2 - textWidth(shown, size) : x + 2;
  return `BT /${font} ${size} Tf ${round(tx)} ${round(y)} Td (${escapePdfText(shown)}) Tj ET\n`;
}

function pageContentStream(
  title: string,
  columns: PdfColumn[],
  rows: string[][]
): string {
  const titleY = PAGE_H - MARGIN - 8;
  const headerY = titleY - 26;
  const firstRowY = headerY - 20;
  const usableW = PAGE_W - 2 * MARGIN;

  const xs: number[] = [];
  let cx = MARGIN;
  for (const c of columns) {
    xs.push(cx);
    cx += c.width;
  }

  let s = "0.5 w\n";
  s += textOp("F2", 15, MARGIN, titleY, title, usableW, "left");
  columns.forEach((c, i) => {
    s += textOp("F2", 9, xs[i], headerY, c.header, c.width, c.align ?? "left");
  });
  s += `${MARGIN} ${round(headerY - 5)} m ${PAGE_W - MARGIN} ${round(headerY - 5)} l S\n`;
  rows.forEach((row, r) => {
    const y = firstRowY - r * ROW_STEP;
    columns.forEach((c, i) => {
      s += textOp("F1", 9, xs[i], y, row[i] ?? "", c.width, c.align ?? "left");
    });
  });
  return s;
}

export function renderTablePdf(opts: TablePdfOptions): Uint8Array<ArrayBuffer> {
  const { title, columns, rows } = opts;

  const pageRows: string[][][] = [];
  for (let i = 0; i < Math.max(rows.length, 1); i += ROWS_PER_PAGE) {
    pageRows.push(rows.slice(i, i + ROWS_PER_PAGE));
  }
  const contents = pageRows.map((rs) => pageContentStream(title, columns, rs));
  const pageCount = contents.length;

  // Object layout: 1 Catalog, 2 Pages, 3..2+P Page objects,
  // 3+P..2+2P content streams, then the two font objects.
  const f1 = 3 + 2 * pageCount;
  const f2 = 4 + 2 * pageCount;
  const lastObj = f2;

  const parts: string[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const emit = (str: string) => {
    parts.push(str);
    pos += str.length;
  };

  emit("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  offsets[1] = pos;
  emit("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  offsets[2] = pos;
  const kids = Array.from(
    { length: pageCount },
    (_, i) => `${3 + i} 0 R`
  ).join(" ");
  emit(
    `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`
  );

  for (let i = 0; i < pageCount; i++) {
    const pageNum = 3 + i;
    const contentNum = 3 + pageCount + i;
    offsets[pageNum] = pos;
    emit(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R ` +
        `/MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> ` +
        `/Contents ${contentNum} 0 R >>\nendobj\n`
    );
  }

  for (let i = 0; i < pageCount; i++) {
    const contentNum = 3 + pageCount + i;
    const c = contents[i];
    offsets[contentNum] = pos;
    emit(
      `${contentNum} 0 obj\n<< /Length ${c.length} >>\nstream\n${c}\nendstream\nendobj\n`
    );
  }

  offsets[f1] = pos;
  emit(
    `${f1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`
  );
  offsets[f2] = pos;
  emit(
    `${f2} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`
  );

  const xrefPos = pos;
  let xref = `xref\n0 ${lastObj + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= lastObj; n++) {
    xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  }
  emit(xref);
  emit(
    `trailer\n<< /Size ${lastObj + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`
  );

  const out = new Uint8Array(pos);
  let o = 0;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) out[o++] = p.charCodeAt(i) & 0xff;
  }
  return out;
}

const EXPENSE_COLUMNS: PdfColumn[] = [
  { header: "Data", width: 62 },
  { header: "Descriere", width: 150 },
  { header: "Sumă (RON)", width: 70, align: "right" },
  { header: "Plătit de", width: 90 },
  { header: "Categorie", width: 80 },
  { header: "Împărțire", width: 90 },
  { header: "Participanți", width: 220 },
];

export function expensesToPdf(
  expenses: ExportExpense[],
  title = "Cheltuieli"
): Uint8Array<ArrayBuffer> {
  const rows = expenses.map((e) => [
    isoDate(e.createdAt),
    e.description,
    baniToInput(e.amount),
    e.paidByName,
    categoryLabel(e.category) ?? "",
    SPLIT_MODE_LABEL[e.splitMode] ?? e.splitMode,
    e.participantNames.join(", "),
  ]);
  return renderTablePdf({ title, columns: EXPENSE_COLUMNS, rows });
}

const BALANCE_COLUMNS: PdfColumn[] = [
  { header: "Membru", width: 162 },
  { header: "Plătit (RON)", width: 120, align: "right" },
  { header: "Datorat (RON)", width: 120, align: "right" },
  { header: "Trimis (RON)", width: 120, align: "right" },
  { header: "Primit (RON)", width: 120, align: "right" },
  { header: "Net (RON)", width: 120, align: "right" },
];

export function balancesToPdf(
  balances: MemberBalance[],
  title = "Solduri"
): Uint8Array<ArrayBuffer> {
  const rows = balances.map((b) => [
    b.name,
    baniToInput(b.paid),
    baniToInput(b.owed),
    baniToInput(b.sent),
    baniToInput(b.received),
    baniToInput(b.net),
  ]);
  return renderTablePdf({ title, columns: BALANCE_COLUMNS, rows });
}
