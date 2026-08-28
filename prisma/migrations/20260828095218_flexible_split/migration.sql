-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "splitMode" TEXT NOT NULL DEFAULT 'EQUAL',
    "groupId" TEXT NOT NULL,
    "paidById" TEXT NOT NULL,
    CONSTRAINT "Expense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "createdAt", "description", "groupId", "id", "paidById") SELECT "amount", "createdAt", "description", "groupId", "id", "paidById" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE TABLE "new_ExpenseParticipant" (
    "expenseId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY ("expenseId", "memberId"),
    CONSTRAINT "ExpenseParticipant_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpenseParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExpenseParticipant" ("expenseId", "memberId") SELECT "expenseId", "memberId" FROM "ExpenseParticipant";
DROP TABLE "ExpenseParticipant";
ALTER TABLE "new_ExpenseParticipant" RENAME TO "ExpenseParticipant";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
