# Expense Splitter

Aplicație simplă tip "Splitwise": creezi un grup, adaugi membri și
cheltuieli, iar aplicația calculează automat cine cui datorează bani.

Scopul, modelele de date și fazele de implementare (ce e gata și ce
urmează) sunt documentate în [`spec.md`](./spec.md).

## Stack
- [Next.js](https://nextjs.org) (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM + PostgreSQL

## Pornire locală

Ai nevoie de un Postgres. Cel mai simplu e o bază gratuită pe
[Neon](https://neon.tech) (aceeași folosită și în producție) sau un
container local `docker run -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres`.

```bash
npm install
cp .env.example .env      # pune connection string-ul de Postgres în DATABASE_URL
npx prisma migrate dev
npm run dev
```

Aplicația pornește pe [http://localhost:3000](http://localhost:3000).

## Deploy pe Vercel

1. Push repo pe GitHub și importă-l în [Vercel](https://vercel.com) (plan Hobby, gratuit).
2. În proiectul Vercel: **Storage → Create Database → Neon** (Postgres). Vercel
   injectează automat `DATABASE_URL` în toate environment-urile.
3. Deploy. Scriptul de build rulează `prisma migrate deploy` înainte de
   `next build`, deci schema se aplică singură la fiecare deploy.
4. Aplicația e live pe `https://<nume-proiect>.vercel.app` — fără domeniu cumpărat.

## Structură

- `src/app` — pagini (App Router) și server actions
- `src/lib` — logică de business (calcul solduri, formatare bani, client Prisma)
- `prisma/schema.prisma` — modelele de date
