// Zero-dependency seed for local testing with several accounts.
//
// Node 20 can't import the generated (TypeScript) Prisma client directly, so
// this script builds plain SQL and runs it through `prisma db execute`. The
// scrypt hashing here MUST match src/lib/auth.ts (`saltHex:hashHex`, keylen 64).
//
//   npm run db:seed     # wipe app rows and re-insert the fixtures below
//   npm run db:reset     # drop the DB, re-run migrations, then seed
//
// Accounts (all password: password123):
//   alice@test.dev  — owns the demo group
//   bob@test.dev    — member of the demo group
//   carol@test.dev  — NOT a member (use the invite link to join)

import { randomBytes, scryptSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PASSWORD = "password123";
const APP_ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3000";

function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const now = new Date();
const iso = (d) => d.toISOString();
const addDays = (n) => new Date(now.getTime() + n * 86_400_000);

const users = [
  { id: "seed_alice", email: "alice@test.dev", name: "Alice" },
  { id: "seed_bob", email: "bob@test.dev", name: "Bob" },
  { id: "seed_carol", email: "carol@test.dev", name: "Carol" },
];

const groupId = "seed_group";
const inviteToken = "seed-invite-token";

// Expense-participant slots inside the group. Cristi is an unclaimed name.
const members = [
  { id: "seed_m_alice", name: "Alice", userId: "seed_alice" },
  { id: "seed_m_bob", name: "Bob", userId: "seed_bob" },
  { id: "seed_m_cristi", name: "Cristi", userId: null },
];

// amount is in bani (1 RON = 100 bani)
const expenses = [
  {
    id: "seed_exp_cazare",
    description: "Cazare",
    amount: 30000,
    category: "cazare",
    splitMode: "EQUAL",
    paidById: "seed_m_alice",
    parts: [
      ["seed_m_alice", 1],
      ["seed_m_bob", 1],
      ["seed_m_cristi", 1],
    ],
  },
  {
    id: "seed_exp_benzina",
    description: "Benzină",
    amount: 12000,
    category: "transport",
    splitMode: "SHARES",
    paidById: "seed_m_bob",
    parts: [
      ["seed_m_alice", 1],
      ["seed_m_bob", 2],
      ["seed_m_cristi", 1],
    ],
  },
];

const payments = [
  { id: "seed_pay_1", amount: 5000, fromId: "seed_m_bob", toId: "seed_m_alice" },
];

const stmts = [];

// --- wipe (children first; Group.owner has no cascade) ---
for (const t of [
  "Payment",
  "ExpenseParticipant",
  "Expense",
  "GroupInvite",
  "GroupMember",
  "Member",
  "Group",
  "Session",
  "User",
]) {
  stmts.push(`DELETE FROM "${t}";`);
}

// --- users ---
for (const u of users) {
  stmts.push(
    `INSERT INTO "User" ("id","email","name","passwordHash","createdAt") VALUES (${q(
      u.id
    )}, ${q(u.email)}, ${q(u.name)}, ${q(hashPassword(PASSWORD))}, ${q(iso(now))});`
  );
}

// --- group owned by Alice, with Alice (owner) + Bob (member) ---
stmts.push(
  `INSERT INTO "Group" ("id","name","createdAt","ownerId") VALUES (${q(
    groupId
  )}, ${q("Vacanța la mare")}, ${q(iso(now))}, ${q("seed_alice")});`
);
stmts.push(
  `INSERT INTO "GroupMember" ("groupId","userId","role","joinedAt") VALUES (${q(
    groupId
  )}, ${q("seed_alice")}, ${q("owner")}, ${q(iso(now))});`
);
stmts.push(
  `INSERT INTO "GroupMember" ("groupId","userId","role","joinedAt") VALUES (${q(
    groupId
  )}, ${q("seed_bob")}, ${q("member")}, ${q(iso(now))});`
);

// --- member slots ---
for (const m of members) {
  stmts.push(
    `INSERT INTO "Member" ("id","name","groupId","userId") VALUES (${q(m.id)}, ${q(
      m.name
    )}, ${q(groupId)}, ${m.userId ? q(m.userId) : "NULL"});`
  );
}

// --- an active invite (for testing accept as Carol) ---
stmts.push(
  `INSERT INTO "GroupInvite" ("token","groupId","createdById","expiresAt","createdAt","revokedAt") VALUES (${q(
    inviteToken
  )}, ${q(groupId)}, ${q("seed_alice")}, ${q(iso(addDays(7)))}, ${q(
    iso(now)
  )}, NULL);`
);

// --- expenses + participants ---
for (const e of expenses) {
  stmts.push(
    `INSERT INTO "Expense" ("id","description","amount","createdAt","category","splitMode","groupId","paidById") VALUES (${q(
      e.id
    )}, ${q(e.description)}, ${e.amount}, ${q(iso(now))}, ${q(e.category)}, ${q(
      e.splitMode
    )}, ${q(groupId)}, ${q(e.paidById)});`
  );
  for (const [memberId, weight] of e.parts) {
    stmts.push(
      `INSERT INTO "ExpenseParticipant" ("expenseId","memberId","weight") VALUES (${q(
        e.id
      )}, ${q(memberId)}, ${weight});`
    );
  }
}

// --- one recorded payment ---
for (const p of payments) {
  stmts.push(
    `INSERT INTO "Payment" ("id","amount","createdAt","groupId","fromId","toId") VALUES (${q(
      p.id
    )}, ${p.amount}, ${q(iso(now))}, ${q(groupId)}, ${q(p.fromId)}, ${q(p.toId)});`
  );
}

const sqlFile = join(tmpdir(), `expense-splitter-seed-${process.pid}.sql`);
writeFileSync(sqlFile, stmts.join("\n") + "\n");

const result = spawnSync(
  "npx",
  ["prisma", "db", "execute", "--file", sqlFile, "--schema", "prisma/schema.prisma"],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "file:./dev.db" },
  }
);
unlinkSync(sqlFile);

if (result.status !== 0) {
  console.error("\nSeed failed.");
  process.exit(result.status ?? 1);
}

console.log(`
Seeded. All accounts use password: ${PASSWORD}

  alice@test.dev   owner of "Vacanța la mare"
  bob@test.dev     member of the group
  carol@test.dev   not a member yet

Invite link (log in as Carol, then open):
  ${APP_ORIGIN}/invite/${inviteToken}
`);
