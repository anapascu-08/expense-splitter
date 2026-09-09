# Expense Splitter

Aplicație simplă tip "Splitwise": creezi un grup, adaugi membri și
cheltuieli, iar aplicația calculează automat cine cui datorează bani.

Scopul, modelele de date și fazele de implementare (ce e gata și ce
urmează) sunt documentate în [`spec.md`](./spec.md).

## Stack
- [Next.js](https://nextjs.org) (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM + PostgreSQL (Neon la deploy; Postgres local prin Docker)

## Pornire locală

Ai nevoie de un PostgreSQL local. Cel mai simplu, prin Docker:

```bash
docker run -d --name expense-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=expense_splitter \
  -p 5432:5432 postgres:16
```

Apoi:

```bash
npm install
cp .env.example .env          # valorile default se potrivesc cu comanda de mai sus
npx prisma migrate deploy     # aplică migrațiile pe baza `expense_splitter`
npm run db:seed               # opțional: conturi + grup demo pentru testare
npm run dev
```

Aplicația pornește pe [http://localhost:3000](http://localhost:3000).

Pentru teste ai nevoie și de baza `expense_splitter_test`:

```bash
docker exec expense-pg createdb -U postgres expense_splitter_test
```

### Conturi de test

`npm run db:seed` șterge datele din aplicație și inserează fixtures pentru
testat autentificarea și accesul multi-utilizator (parola pentru toate:
`password123`):

| Cont | Rol |
|---|---|
| `alice@test.dev` | owner al grupului „Vacanța la mare" (cu cheltuieli + o plată) |
| `bob@test.dev` | membru în grup |
| `carol@test.dev` | fără grup — testează invitația: login ca Carol, apoi deschide `http://localhost:3000/invite/seed-invite-token` |

### Reset de parolă

„Ai uitat parola?" din `/login` funcționează fără nimic suplimentar — se
creează tokenul, dar emailul nu pleacă decât dacă e setat `RESEND_API_KEY`
(cont gratuit pe [resend.com](https://resend.com)) în `.env`. Fără el, cererea
tot reușește (mesaj generic, ca să nu scurgă ce conturi există), doar că
linkul de resetare nu ajunge nicăieri — eroarea de livrare e doar logată în
consola serverului, nu afișată utilizatorului.

Pentru mai multe conturi logate simultan folosește ferestre separate
(normală + incognito) sau profile de browser diferite — sesiunea e un
cookie per context de browser.

`npm run db:reset` face drop la schema, reaplică migrațiile și rulează seed-ul.

Dacă ai deja `node_modules`, `.env` și Postgres-ul pornit, e suficient
`npm run dev`.

### Baza de date

- `.env` conține `DATABASE_URL` (folosit de aplicație) și `DIRECT_URL`
  (folosit doar de `prisma migrate`). Local pot fi identice; pe Vercel
  `DATABASE_URL` e conexiunea *pooled* Neon, iar `DIRECT_URL` cea *unpooled*.
- `npx prisma migrate deploy` aplică migrațiile din `prisma/migrations/`;
  `npx prisma migrate dev --name <descriere>` creează o migrație nouă după ce
  modifici `prisma/schema.prisma`.
- `postinstall` rulează `prisma generate` (Prisma Client în `src/generated/prisma`,
  gitignored).

Comenzi utile:

```bash
npx prisma studio            # UI web pentru inspectat/editat datele
npx prisma migrate reset     # drop schema + reaplică migrațiile de la zero
npx prisma generate          # regenerează doar Prisma Client
```

> Pașii de deploy pe Vercel + Neon sunt în [`DEPLOY.md`](./DEPLOY.md).

## Teste & verificare

Lucrăm test-first (runner: [Vitest](https://vitest.dev)), pe două proiecte:

- **unit** (`src/**/*.test.ts`) — logică pură din `src/lib/`, fără I/O.
- **integration** (`src/**/*.integration.test.ts`) — `src/lib/access.ts`,
  sesiunile din `src/lib/auth.ts` și server actions, rulate pe o bază Postgres
  de test (`TEST_DATABASE_URL`, default `expense_splitter_test` pe localhost) cu
  `next/headers` · `next/navigation` · `next/cache` mock-uite. Harness-ul e în
  `src/test/`; `globalSetup` face drop la schema și reaplică migrațiile la
  fiecare rulare.

```bash
npm test          # watch — bucla TDD (ambele proiecte)
npm run test:run  # o singură rulare
npm run check     # tsc --noEmit && eslint && vitest run (rulează înainte de commit)
```

CI (`.github/workflows/ci.yml`) pornește un serviciu `postgres:16`, aplică
migrațiile și rulează `npm run check` + `next build` la fiecare push pe
`main` / `deploy-postgres` și la fiecare PR.

## Structură

- `src/app` — pagini (App Router) și server actions
- `src/lib` — logică de business (calcul solduri, formatare bani, client Prisma)
- `prisma/schema.prisma` — modelele de date
