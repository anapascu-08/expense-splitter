# Expense Splitter — Spec (MVP)

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS pentru UI
- Prisma ORM + PostgreSQL (Neon în producție, deploy pe Vercel)

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

## Faze de implementare

### Faza 0 — MVP ✅ (implementată)
- Creare grup, adăugare membri
- Adăugare cheltuială cu împărțire egală între participanți
- Ștergere cheltuială
- Calcul automat solduri + listă minimă de transferuri (settle-up)

### Faza 1 — Editare & corectură
- Editare cheltuială existentă (descriere, sumă, plătitor, participanți)
- Editare/ștergere membru dintr-un grup (cu grijă la cheltuielile existente)
- Editare nume grup, ștergere grup
- Confirmare înainte de ștergere (momentan ștergerea e imediată, fără confirmare)

### Faza 2 — Împărțire flexibilă
- Sume custom per participant (nu doar împărțire egală)
- Împărțire pe procente sau pe cote (shares)
- Validare: suma părților trebuie să fie egală cu totalul cheltuielii

### Faza 3 — Plăți & decontări persistate
- Model `Payment` (cine a plătit cui, cât, când) — momentan settle-up e doar
  calculat live, nu se poate marca o datorie ca „achitată”
- Istoric plăți per grup
- Solduri recalculate ținând cont de plățile deja făcute

### Faza 4 — Autentificare & acces multi-utilizator
- Conturi reale de utilizator (în loc de membri fără login)
- Linkuri de invitație pentru a intra într-un grup
- Fiecare utilizator își vede propriile grupuri; permisiuni de bază

### Faza 5 — Polish & extra
- Multiple valute
- Categorii de cheltuieli (mâncare, transport, cazare etc.)
- Notificări (email/push) când se adaugă o cheltuială nouă
- Export (CSV/PDF) al cheltuielilor și soldurilor
- Grafice/rezumat vizual al cheltuielilor pe grup
