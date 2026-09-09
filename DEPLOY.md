# Deploy pe Vercel + Neon

Pașii de mai jos se fac **o singură dată**, în dashboard-ul Vercel — nu se pot
automatiza din repo. Codul de pe `main` e deja pregătit (schema Postgres,
migrațiile în `prisma/migrations/`, `npm run build` rulează `prisma migrate
deploy`).

## 1. Importă proiectul

1. [vercel.com](https://vercel.com) → *Sign in with GitHub*.
2. *Add New… → Project* → importă `anapascu-08/expense-splitter`.
3. Framework preset: **Next.js** (detectat automat). Nu apăsa **Deploy** încă.

## 2. Baza de date (Neon)

1. În proiect: *Storage → Create Database → Neon (Postgres)* → *Connect*.
2. Vercel injectează automat variabilele de conexiune, printre care:
   - `DATABASE_URL` — conexiune **pooled** (prin PgBouncer). Asta folosește
     aplicația la runtime.
   - `DATABASE_URL_UNPOOLED` (sau `POSTGRES_URL_NON_POOLING`) — conexiune
     **directă**.

## 3. Variabile de mediu

*Settings → Environment Variables* (pentru toate: Production + Preview + Development):

| Nume | Valoare |
|---|---|
| `DATABASE_URL` | lăsat de Neon (pooled) — deja setat |
| `DIRECT_URL` | copiază valoarea din `DATABASE_URL_UNPOOLED` |
| `APP_ORIGIN` | URL-ul deployat, ex. `https://<proiect>.vercel.app` — folosit în linkul din emailul de reset parolă; fără el linkul arată spre `localhost` |
| `RESEND_API_KEY` | *(opțional)* cheie de la [resend.com](https://resend.com). Fără ea, „ai uitat parola?" tot creează tokenul, dar emailul nu pleacă (eroarea e doar logată). |
| `RESEND_FROM` | *(opțional)* adresa expeditor, ex. `onboarding@resend.dev`. Pentru alți destinatari decât contul tău Resend ai nevoie de un domeniu verificat. |

`DIRECT_URL` e obligatoriu: `prisma migrate deploy` (rulat în timpul build-ului)
are nevoie de o sesiune directă, nu de pool.

## 4. Build & branch

*Settings → Build and Deployment*:

- **Build Command:** `prisma migrate deploy && next build`
  (identic cu scriptul `build` din `package.json` — poți lăsa "Use default").
- **Install Command:** default (`npm install` → rulează `postinstall: prisma
  generate`).

*Settings → Git*:

- **Production Branch:** `main`.
  Fiecare PR (sau push pe un branch non-`main`) primește un **Preview
  Deployment** cu URL propriu — folosește-l ca să verifici înainte de merge pe
  `main`.

## 5. Primul deploy

1. Push pe `main` → Vercel rulează `npm install` → `prisma migrate deploy`
   (creează tabelele pe Neon) → `next build` → publică pe
   `https://<proiect>.vercel.app`.
2. (Opțional) rulează seed-ul o singură dată împotriva bazei Neon, de pe
   mașina ta:
   ```bash
   DATABASE_URL="<pooled Neon URL>" DIRECT_URL="<unpooled Neon URL>" npm run db:seed
   ```

## Note

- Schema Prisma e `provider = "postgresql"` cu `url` (pooled) + `directUrl`
  (unpooled). Local, ambele pot fi aceeași conexiune (vezi `.env.example`).
- Migrațiile SQLite vechi au fost șterse; `prisma/migrations/` e în dialect
  Postgres. Neon pornește goală, deci `migrate deploy` le aplică curat.
- Nu există `vercel.json` — presetul Next.js acoperă tot.
