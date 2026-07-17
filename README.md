# Bento

Bento is a calm, visual meal planner for breakfasts, snacks, and lunches. Build a reusable food library, drag foods into the week, generate low-repeat menus, switch to a full-month view, and copy an automatically prepared shopping list. Foods and plans are stored in Neon Postgres so they persist across browsers and devices.

## Run locally

```bash
npm install
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verify

```bash
npm run lint
npm test
npm run build
```

## Deploy to Vercel

Import this repository in Vercel or run `vercel`. The project uses the Next.js App Router and requires the pooled `DATABASE_URL` plus the direct `DATABASE_URL_UNPOOLED` from Neon.

## Data model

Foods and dated meal-plan items are stored in Neon Postgres through Drizzle ORM and validated Next.js server actions. There is intentionally no login: the deployment uses one shared household dataset, so anyone with the deployment URL can view and change the same food library and plans. The database starts empty.
