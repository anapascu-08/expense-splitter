# Expense Splitter

Aplicație simplă tip "Splitwise": creezi un grup, adaugi membri și
cheltuieli, iar aplicația calculează automat cine cui datorează bani.

Scopul, modelele de date și fazele de implementare (ce e gata și ce
urmează) sunt documentate în [`spec.md`](./spec.md).

## Stack
- [Next.js](https://nextjs.org) (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM + SQLite

## Pornire locală

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

Aplicația pornește pe [http://localhost:3000](http://localhost:3000).

Dacă ai deja `node_modules`, `.env` și baza de date create (de exemplu
pe mașina pe care ai dezvoltat inițial), e suficient `npm run dev`.

## Structură

- `src/app` — pagini (App Router) și server actions
- `src/lib` — logică de business (calcul solduri, formatare bani, client Prisma)
- `prisma/schema.prisma` — modelele de date
