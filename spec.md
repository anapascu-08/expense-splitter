# Expense Splitter — Spec (MVP)

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS pentru UI
- Prisma ORM + SQLite (fișier local `dev.db`) în dev; PostgreSQL la deploy

## Deploy

- **Hosting:** Vercel (plan Hobby, gratuit) — deploy automat din GitHub,
  subdomeniu `*.vercel.app` (fără domeniu cumpărat).
- **Bază de date:** PostgreSQL pe Neon (free tier). Vercel injectează
  `DATABASE_URL` prin integrarea Storage → Neon.
- **Migrații:** scriptul de build rulează `prisma migrate deploy` înainte de
  `next build`, deci schema se aplică singură la fiecare deploy.
- Local se lucrează în continuare pe SQLite; trecerea pe Postgres + Vercel
  e izolată pe branch-ul `deploy-postgres` și se aduce pe `main` chiar
  înainte de publicare. Detalii în [`ARCHITECTURE.md`](./ARCHITECTURE.md).

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

### Faza 1 — Editare & corectură ✅ (implementată)
- Editare cheltuială existentă (descriere, sumă, plătitor, participanți) — pagină
  dedicată `/groups/[id]/expenses/[expenseId]/edit`
- Editare/ștergere membru dintr-un grup — ștergerea e blocată (UI + server) cât
  timp membrul e legat de cheltuieli sau plăți
- Editare nume grup, ștergere grup
- Confirmare înainte de ștergere — componenta `ConfirmButton` pe toate acțiunile
  distructive

### Faza 2 — Împărțire flexibilă ✅ (implementată)
- Sume custom per participant (nu doar împărțire egală) — mod `EXACT`
- Împărțire pe procente — mod `PERCENT`
- Împărțire pe cote (shares) — mod `SHARES`: fiecare participant primește un
  număr întreg de cote, iar suma se împarte proporțional (fără sumă fixă)
- Validare: la `EXACT`/`PERCENT` suma părților trebuie să fie egală cu totalul
  cheltuielii; la `SHARES` fiecare participant are minim o cotă
- UI/UX: selector de mod (egal / sume exacte / procente / cote) în formularul
  de cheltuială; câmp per participant care apare doar pentru modul ales;
  pentru `EXACT`/`PERCENT` indicator live „alocat X / total Y" cu diferența
  evidențiată roșu până când se închide la zero; pentru `SHARES` preview cu
  cât iese fiecare; submit blocat cât timp nu se potrivește.

### Faza 3 — Plăți & decontări persistate ✅ (implementată)
- Model `Payment` (cine a plătit cui, cât, când)
- Istoric plăți per grup — secțiune „Plăți", fiecare cu ștergere confirmată
- Solduri recalculate ținând cont de plățile deja făcute
  (`net = plătit − datorat + trimis − primit`)
- UI/UX: buton „marchează achitat" pe fiecare linie din lista de transferuri,
  care creează plata cu suma din transfer; istoricul plăților ca secțiune
  separată sub solduri, cu opțiune de anulare.

### Faza 4 — Autentificare & acces multi-utilizator ✅ (implementată)
- Conturi reale de utilizator (`User` + email/parolă) — auth hand-rolled,
  fără dependințe: `node:crypto` scrypt pentru parole (`src/lib/auth.ts`),
  sesiuni opace în tabelul `Session` (cookie httpOnly cu token random, în DB
  doar hash-ul SHA-256 → nu e nevoie de secret)
- `Member` rămâne nume liber; accesul la grup e separat prin `GroupMember`
  (`role`: `owner` | `member`). `Member.userId` e pregătit pentru „revendicare"
  dar claiming-ul efectiv nu e încă implementat
- Linkuri de invitație (`GroupInvite`, `/invite/[token]`) — refolosibile, expiră
  după 7 zile, pot fi revocate; accept = `upsert` `GroupMember` cu rol `member`
- Fiecare utilizator vede doar grupurile în care e `GroupMember`; ne-membru care
  accesează direct URL-ul grupului primește 404 (nu scurgem existența).
  Enforce în DAL (`requireUser` / `requireGroupAccess` — `src/lib/access.ts`)
  la fiecare pagină + server action; fără middleware/proxy
- Doar owner-ul poate redenumi / șterge grupul
- UI/UX: ecrane `/login` + `/register` minimale (`AuthForm` cu `useActionState`,
  erori inline); pagina de invitație arată cine invită + numele grupului înainte
  de accept, cu mesaj clar pentru link expirat/revocat/invalid; nelogat →
  `/login?next=…` și revenire după autentificare; header global (`SiteHeader`)
  cu numele userului + „Deconectare"

Rămas pe viitor: reset parolă, verificare email, OAuth, claiming efectiv al
unui slot `Member` la accept invitație.

### Faza 5 — Polish & extra
- Multiple valute
- ✅ Categorii de cheltuieli — set fix de categorii (mâncare, transport,
  cazare, băuturi, activități, cumpărături, altele) în `src/lib/categories.ts`;
  câmp `Expense.category` (nullable); selector în formular; iconiță + etichetă
  pe fiecare cheltuială; rezumat „Pe categorii" sub lista de cheltuieli
- Notificări (email/push) când se adaugă o cheltuială nouă
- ✅ Export CSV — route handler `GET /groups/[id]/export?type=expenses|balances`
  (protejat cu `requireGroupAccess`), serializare pură test-first în
  `src/lib/csv.ts` (RFC 4180), sume cu punct zecimal + BOM UTF-8 pentru Excel.
  PDF încă nu.
- Grafice/rezumat vizual al cheltuielilor pe grup

### Faza 6 — UI/UX & polish vizual

Până acum UI-ul e strict funcțional (formulare + tabele Tailwind, fără
tratare de stări). Faza asta îl aduce la un nivel „prezentabil", fără
librării de componente noi — doar Tailwind și convențiile deja folosite.

**Principii**
- Mobile-first: fluxul principal (grup → adaugă cheltuială → vezi solduri)
  trebuie să fie comod pe telefon, o singură coloană.
- Zero configurare inutilă: valorile implicite bune (toți membrii participă,
  plătitor = ultimul selectat) rămân un click distanță.
- Feedback imediat la fiecare acțiune (server action) — stare de „se salvează",
  apoi confirmare sau eroare vizibilă.

**Layout & navigație**
- Header simplu cu numele aplicației (link spre `/`) și, pe pagina de grup,
  numele grupului + breadcrumb „← Toate grupurile".
- Pagina de grup pe secțiuni clare, în ordinea folosirii: Membri → Cheltuieli
  → Solduri / cine-cui-datorează. Pe desktop soldurile pot sta într-o coloană
  laterală lipicioasă (sticky).
- Container cu lățime maximă (`max-w-2xl` pe flux, mai lat unde e tabel).

**Stări de UI (de tratat explicit peste tot)**
- Loading: butoanele de submit devin disabled + text „Se salvează…";
  liste cu skeleton simplu la prima încărcare.
- Empty: mesaje utile în loc de tabel gol — „Niciun grup încă. Creează
  primul grup." / „Nicio cheltuială. Adaugă una ca să vezi soldurile."
- Error: mesaj inline sub formular (nu alert), cu textul erorii din server
  action; câmpul invalid marcat.
- Success: toast/mesaj discret care dispare, fără redirect brusc.

**Componente & interacțiune**
- Formularele de adăugare cheltuială / membru: inline pe pagină, nu modal;
  se resetează după submit și păstrează focus pentru intrări repetate.
- Confirmările de ștergere (din Faza 1): dialog cu numele entității în text,
  buton de confirmare marcat ca acțiune distructivă (roșu).
- Sume afișate formatat: `1.234,56 RON` (separator local RO), aliniate la
  dreapta în tabele.
- Solduri colorate: verde = i se datorează, roșu = datorează; lista de
  transferuri cu format „A → B: sumă".

**Vizual**
- Paletă neutră + o culoare de accent pentru acțiuni primare; roșu rezervat
  pentru distructiv, verde/roșu doar pentru semnul soldului.
- Spațiere consistentă (scale Tailwind 4/6/8), colțuri rotunjite uniforme,
  o singură umbră pentru carduri.
- Dark mode dacă e ieftin (`dark:` + `prefers-color-scheme`).

**Accesibilitate**
- Toate inputurile cu `<label>` asociat; butoanele cu text real (nu doar icon).
- Focus vizibil, navigare completă din tastatură, contrast AA.
- Erorile legate de câmp prin `aria-describedby`.
