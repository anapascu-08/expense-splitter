# Expense Splitter

Aplicație simplă tip "Splitwise": creezi un grup, adaugi membri și
cheltuieli, iar aplicația calculează automat cine cui datorează bani.

Scopul, modelele de date și fazele de implementare (ce e gata și ce
urmează) sunt documentate în [`spec.md`](./spec.md).

## Stack
- [Next.js](https://nextjs.org) (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM + SQLite (fișier local, fără server de bază de date)

## Pornire locală

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed        # opțional: conturi + grup demo pentru testare
npm run dev
```

Aplicația pornește pe [http://localhost:3000](http://localhost:3000).

### Conturi de test

`npm run db:seed` șterge datele din aplicație și inserează fixtures pentru
testat autentificarea și accesul multi-utilizator (parola pentru toate:
`password123`):

| Cont | Rol |
|---|---|
| `alice@test.dev` | owner al grupului „Vacanța la mare" (cu cheltuieli + o plată) |
| `bob@test.dev` | membru în grup |
| `carol@test.dev` | fără grup — testează invitația: login ca Carol, apoi deschide `http://localhost:3000/invite/seed-invite-token` |

Pentru mai multe conturi logate simultan folosește ferestre separate
(normală + incognito) sau profile de browser diferite — sesiunea e un
cookie per context de browser.

`npm run db:reset` face drop la `dev.db`, reaplică migrațiile și rulează seed-ul.

Dacă ai deja `node_modules`, `.env` și baza de date create (de exemplu
pe mașina pe care ai dezvoltat inițial), e suficient `npm run dev`.

### Baza de date SQLite

Nu ai nevoie de Postgres sau de alt server local — baza de date e un
singur fișier.

- `.env` conține `DATABASE_URL="file:./dev.db"` (relativ la folderul
  `prisma/`), deci fișierul e `prisma/dev.db`.
- `npx prisma migrate dev` creează `prisma/dev.db`, aplică migrațiile din
  `prisma/migrations/` și regenerează Prisma Client în `src/generated/prisma`.
- `prisma/dev.db` e în `.gitignore` — fiecare dezvoltator își are propria
  copie locală, cu propriile date de test.

Comenzi utile:

```bash
npx prisma studio            # UI web pentru inspectat/editat datele
npx prisma migrate reset     # șterge dev.db, reaplică migrațiile de la zero
npx prisma generate          # regenerează doar Prisma Client (după pull cu schema schimbată)
```

După ce modifici `prisma/schema.prisma`, rulează
`npx prisma migrate dev --name <descriere>` ca să creezi o migrație nouă.

> Postgres (Neon) se folosește doar la deploy pe Vercel și e izolat pe
> branch-ul `deploy-postgres`. Pe `main` se lucrează în continuare pe SQLite.
> Vezi [`spec.md`](./spec.md) și [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Teste & verificare

Lucrăm test-first (runner: [Vitest](https://vitest.dev)), pe două proiecte:

- **unit** (`src/**/*.test.ts`) — logică pură din `src/lib/`, fără I/O.
- **integration** (`src/**/*.integration.test.ts`) — `src/lib/access.ts`,
  sesiunile din `src/lib/auth.ts` și server actions, rulate pe o bază SQLite
  de test (`prisma/test.db`) cu `next/headers` · `next/navigation` · `next/cache`
  mock-uite. Harness-ul e în `src/test/`; migrarea bazei de test se face automat
  (`prisma migrate deploy`) în `globalSetup`.

```bash
npm test          # watch — bucla TDD (ambele proiecte)
npm run test:run  # o singură rulare
npm run check     # tsc --noEmit && eslint && vitest run (rulează înainte de commit)
```

CI (`.github/workflows/ci.yml`) rulează `npm run check` + `npm run build` la
fiecare push pe `main` și la fiecare PR.

## Structură

- `src/app` — pagini (App Router) și server actions
- `src/lib` — logică de business (calcul solduri, formatare bani, client Prisma)
- `prisma/schema.prisma` — modelele de date
