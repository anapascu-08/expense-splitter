# Expense Splitter — Spec (MVP)

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS pentru UI
- Prisma ORM + SQLite (fișier local `dev.db`)

## Scop MVP
O aplicație simplă tip "Splitwise" pentru un grup de prieteni care vor
să țină evidența cheltuielilor comune și să vadă cine cui datorează bani.

Nu includem în MVP: autentificare, multiple valute, sume/procente custom
per participant, plăți parțiale, notificări. Acestea sunt candidați pentru
o versiune viitoare.

## Modele de date

**Group**
- id, name, createdAt

**Member**
- id, groupId, name

**Expense**
- id, groupId, description, amount (RON, în bani întregi sau bani/100 — decidem în implementare), paidById (Member), createdAt
- participanții cheltuielii = subset de membri ai grupului între care se împarte suma EGAL (implicit toți membrii grupului)

**ExpenseParticipant** (join table)
- expenseId, memberId

## Flux utilizator
1. Creezi un grup (nume) → primești o pagină de grup.
2. Adaugi membri în grup (nume simplu, fără cont/login).
3. Adaugi o cheltuială: descriere, sumă, cine a plătit, cine participă
   (implicit toți membrii curenți ai grupului).
4. Aplicația calculează automat soldurile: cât a plătit fiecare vs. cât
   ar fi trebuit să plătească (share egal din cheltuielile la care participă).
5. Vezi o listă de tip "X îi datorează lui Y suma Z" (simplificată, nu
   tranzacție cu tranzacție — algoritm de "settle up" minimal).

## Pagini
- `/` — listă de grupuri existente + formular de creare grup.
- `/groups/[id]` — detaliu grup: membri, listă cheltuieli, adăugare
  cheltuială, tabel solduri / cine-cui-datorează.

## Algoritm solduri
Pentru fiecare membru: `net = totalPlătit - totalDatorat`.
- `totalPlătit` = suma cheltuielilor plătite de el.
- `totalDatorat` = suma share-urilor lui din cheltuielile la care participă
  (share = amount / nr. participanți, egal pentru toți).

Din valorile `net` (pozitiv = i se datorează, negativ = datorează),
generăm o listă minimă de transferuri care echilibrează soldurile
(greedy: cel mai mare debitor plătește cel mai mare creditor, repetă).

## Ce urmează după MVP (idei, neimplementate acum)
- Autentificare / conturi reale de utilizator
- Împărțire pe sume custom sau procente
- Marcarea unei datorii ca „plătită”
- Editare/ștergere cheltuieli
- Multiple valute
