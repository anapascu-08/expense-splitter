# Deploy pe Vercel + Neon

Pașii de mai jos se fac **o singură dată**, în dashboard-ul Vercel — nu se pot
automatiza din repo. Codul e deja pregătit pe branch-ul `deploy-postgres`
(schema Postgres, migrația `init`, `npm run build` rulează `prisma migrate
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
| `DATABASE_URL` | lasat de Neon (pooled) — deja setat |
| `DIRECT_URL` | copiază valoarea din `DATABASE_URL_UNPOOLED` |

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
  Fiecare push pe `deploy-postgres` (sau orice PR) primește un **Preview
  Deployment** cu URL propriu — folosește-le ca să verifici înainte de a face
  merge pe `main`.

## 5. Primul deploy

1. Fă merge `deploy-postgres` → `main` (sau deschide un PR și lasă Preview-ul
   să confirme).
2. Push pe `main` → Vercel rulează `npm install` → `prisma migrate deploy`
   (creează tabelele pe Neon) → `next build` → publică pe
   `https://<proiect>.vercel.app`.
3. (Opțional) rulează seed-ul o singură dată împotriva bazei Neon, de pe
   mașina ta:
   ```bash
   DATABASE_URL="<pooled Neon URL>" DIRECT_URL="<unpooled Neon URL>" npm run db:seed
   ```

## Note

- Schema Prisma e `provider = "postgresql"` cu `url` (pooled) + `directUrl`
  (unpooled). Local, ambele pot fi aceeași conexiune (vezi `.env.example`).
- Migrațiile SQLite vechi au fost șterse; există o singură migrație `init` în
  dialect Postgres. Neon pornește goală, deci `migrate deploy` o aplică curat.
- Nu există `vercel.json` — presetul Next.js acoperă tot.
