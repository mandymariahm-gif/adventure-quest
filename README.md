# Adventure Quest 🐾

A digital scrapbook + quest platform that turns in-person events into shared, collectible memories. Friends draw quests during an event, snap the proof, and the app assembles a scrapbook when the night ends. First quest pack: **Brew at the Zoo** (61 quests).

Built as an installable, offline-first Progressive Web App: **Next.js 14 · TypeScript · Tailwind · Supabase (Postgres + Auth + Storage) · Dexie (IndexedDB)**.

> Every screen answers one question first: *will this help someone remember this day?* Points and champions are seasoning; the scrapbook and Time Capsule are the meal.

---

## What's included

- **Host flow** — create events, QR + link invites, start/end, live join & completion counts
- **Participant flow** — join via invite link, draw 10 quests (5 active, auto-refill), complete with photo + note, hidden **Legendary Quest** that unlocks after 5 completions
- **Offline-first** — quest state, photos, and notes save to IndexedDB with no signal and sync automatically when connectivity returns (works on iPhone too, where the Background Sync API doesn't exist — we use our own persistent queue instead)
- **Scrapbook** — generated when the host ends the event: polaroid photo grid, timeline of the night, stats, final standings, champion
- **Time Capsule** — 7 answers sealed until the week before next year's event
- **Profiles & achievements** — events attended, quests done, legendaries, champion wins
- **Pack-agnostic engine** — "Brew at the Zoo" is seed data, not special-cased code; add packs without touching the engine

Included as endpoints but not yet wired into UI (Phase 4 in the roadmap): friend verification (`POST /api/quest-completions/:id/verify`) and voting (`.../vote`).

---

## Part 1 — Run it locally (start here)

### 1. Install the prerequisites

You need three free tools:

1. **Git** — [git-scm.com/downloads](https://git-scm.com/downloads). Accept the defaults.
2. **Node.js 20 (LTS)** — [nodejs.org](https://nodejs.org). This also installs `npm`.
3. **VS Code** (or any editor) — [code.visualstudio.com](https://code.visualstudio.com).

Verify in a terminal (Terminal on Mac, "Git Bash" or PowerShell on Windows):

```bash
git --version
node --version   # should print v20.x or newer
npm --version
```

### 2. Get the code and install dependencies

```bash
cd adventure-quest
npm install
```

### 3. Create a free Supabase project (your database + auth + photo storage)

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign up (free).
2. **New project** → pick any name (e.g. `adventure-quest`), set a database password (save it somewhere), choose the region closest to you → **Create**.
3. Wait ~2 minutes for it to provision.

### 4. Set your environment variables

1. In the project folder, copy the example file:
   ```bash
   cp .env.example .env.local
   ```
2. In the Supabase dashboard go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ *server-only secret — never share it or commit it*
3. Leave `NEXT_PUBLIC_SITE_URL=http://localhost:3000` for now.

### 5. Create the database tables

1. In the Supabase dashboard, open **SQL Editor** → **New query**.
2. Open `supabase/migrations/0001_init.sql` from this project, copy **the whole file**, paste it into the editor, and click **Run**.
3. You should see "Success. No rows returned." That's every table, security policy, achievement, and the photo storage bucket.

*(Prefer the CLI? `npx supabase link` + `npx supabase db push` does the same thing.)*

### 6. Load the Brew at the Zoo quest pack

```bash
npm run seed
```

You should see: `Seeded "Brew at the Zoo" with 61 quests.`

### 7. Configure sign-in redirects

Magic links need to know where to send people back to:

1. Supabase dashboard → **Authentication → URL Configuration**
2. **Site URL**: `http://localhost:3000`
3. **Redirect URLs**: add `http://localhost:3000/auth/callback`

(No other auth setup needed — email magic links work out of the box on the free tier. To add Google/Apple sign-in later: **Authentication → Providers**.)

### 8. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter your email, click the link Supabase emails you, and you're in. Create an event, pick Brew at the Zoo, open the invite link in a second browser (or your phone on the same Wi-Fi) to play as a participant.

> **Tip for testing solo:** use a second email address, or Chrome's incognito window, as your "friend."

---

## Part 2 — Deploy to the internet (Vercel)

Vercel is made by the Next.js team and has a generous free tier — it's the smoothest home for this app.

### 1. Put the code on GitHub

1. Create a free account at [github.com](https://github.com) → **New repository** → name it `adventure-quest`, keep it **Private** → Create.
2. In your project folder:
   ```bash
   git init
   git add .
   git commit -m "Adventure Quest MVP"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/adventure-quest.git
   git push -u origin main
   ```
   (`.env.local` is git-ignored, so your secrets stay on your machine.)

### 2. Import into Vercel

1. Sign up at [vercel.com](https://vercel.com) **with your GitHub account**.
2. **Add New → Project** → pick your `adventure-quest` repo → it auto-detects Next.js.
3. Before deploying, open **Environment Variables** and add all four values from your `.env.local` — but set `NEXT_PUBLIC_SITE_URL` to your Vercel URL (you'll see it on the next screen; it looks like `https://adventure-quest-xyz.vercel.app`). You can deploy first, read the URL, add the variable, and hit **Redeploy** — that works fine too.
4. Click **Deploy**. ~2 minutes later your app is live with HTTPS automatically.

### 3. Point Supabase at your live URL

Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: add `https://your-app.vercel.app/auth/callback` (keep the localhost one too so local dev still works)

### 4. Custom domain (optional)

1. Buy a domain anywhere (Namecheap, Cloudflare, ~$10/yr).
2. Vercel → your project → **Settings → Domains** → add it → follow the DNS instructions shown.
3. HTTPS is automatic. Then update `NEXT_PUBLIC_SITE_URL` and the Supabase redirect URLs to the new domain and redeploy.

### 5. Publishing updates

Just push to GitHub — Vercel redeploys automatically:

```bash
git add . && git commit -m "describe your change" && git push
```

Every pull request also gets its own preview URL for free.

> **Other hosts:** Netlify and Railway both work (import repo, add the same env vars). Cloudflare Pages requires the `@cloudflare/next-on-pages` adapter and Render needs a Node service — Vercel is the path of least resistance for Next.js.

---

## Part 3 — Installing it like an app (PWA)

Once deployed (PWAs require HTTPS):

- **Android/Chrome**: menu ⋮ → **Add to Home screen** (Chrome usually offers an install banner automatically).
- **iPhone/Safari**: Share button → **Add to Home Screen**.
- **Desktop Chrome/Edge**: install icon in the address bar.

What the PWA layer does (`public/manifest.json` + `public/sw.js`):
- caches the app shell, fonts, and icons so the app opens instantly
- serves a friendly `/offline` page if a never-cached page is opened with no signal
- caches scrapbook photos (stale-while-revalidate)
- and the app itself (not the service worker) queues every quest completion, photo, and time capsule in IndexedDB and flushes them to `/api/sync/batch` whenever the device comes back online — this is deliberate, because iOS Safari doesn't support the Background Sync API, and a persistent in-app queue works everywhere

**To ship a service-worker update**, bump the `VERSION` string at the top of `public/sw.js` — old caches are cleaned up automatically on activation.

---

## How the pieces fit

```
app/                      Next.js App Router
  page.tsx                landing + magic-link sign-in
  dashboard/              host & participant home
  events/new              create event
  events/[id]/manage      QR invite, live stats, start/end
  join/[code]             invite deep link (joins + redirects)
  quests/[eventId]        quest board (offline-first)
  scrapbook/[eventId]     generated scrapbook + time capsule
  profile/                stats + achievements
  api/                    business rules live here (service-role writes)
components/               quest sheet, time capsule, UI bits
lib/
  supabase/               browser/server/admin clients
  offline/                Dexie schema + sync queue engine
public/sw.js              service worker (cache strategies)
supabase/migrations/      full schema + RLS policies
quest-packs/              brew-at-the-zoo.json (61 quests)
scripts/seed.mjs          loads a pack into the database
```

**Security model:** reads go through Supabase row-level security (participants can only see their own events); all writes with business rules (joining, drawing, completing, scoring, scrapbook generation) go through the API layer using the service role, so points can't be forged from the browser. Completion IDs are client-generated UUIDs, which makes offline retries idempotent — a flaky connection can never double-award points.

**Adding a new quest pack:** copy `quest-packs/brew-at-the-zoo.json`, change the name and quests, point `scripts/seed.mjs` at the new file (or generalize it to take a path argument), run `npm run seed`. The engine doesn't change.

---

## Expected costs

| Service | Free tier | When you'd pay |
| --- | --- | --- |
| Vercel | Hobby: plenty for a friend group | Basically never at this scale |
| Supabase | 500MB database, 1GB storage, 50K monthly active users | Photos add up — 1GB ≈ 2,500 compressed photos. Pro is $25/mo if you outgrow it |
| Domain | — | ~$10–15/yr, optional |

A yearly event with 20 friends fits comfortably in **$0/month**. Note: Supabase free-tier projects pause after a week of inactivity — just hit "Restore" in the dashboard before your event, or upgrade to Pro during event season.

## Backups & maintenance

- Supabase dashboard → **Database → Backups**: Pro has automatic daily backups; on the free tier, export occasionally via **Database → Backups → Download** or `npx supabase db dump`.
- Photos live in the `photos` storage bucket — download the bucket before deleting anything.
- Update dependencies now and then: `npm outdated`, then `npm update`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Magic-link email lands you on an error page | The redirect URL isn't whitelisted: Supabase → Auth → URL Configuration → add `/auth/callback` for the exact domain you're on |
| "No quest packs found" when creating an event | Run `npm run seed` (and check `.env.local` has the service role key) |
| `npm run seed` says missing env vars | You edited `.env.example` instead of creating `.env.local` |
| Photos don't appear in the scrapbook | Confirm the `photos` bucket exists (the migration creates it) and is public: Supabase → Storage |
| Changes don't show up in the installed PWA | Bump `VERSION` in `public/sw.js`, redeploy, then close and reopen the app |
| "relation does not exist" errors | The migration didn't run — re-paste `0001_init.sql` into the SQL editor and run it |
| Sign-in works locally but not in production | `NEXT_PUBLIC_SITE_URL` env var on Vercel still points at localhost |
| Event is stuck in Draft for participants | Only the host sees the Start button — Manage → **Start event** |

## Roadmap

Shipped in this MVP: Phases 1–3 and most of 5–6 from the architecture doc (foundation, quest engine, offline-first, scrapbook, time capsule, profiles/achievements). Next up, in order:

1. **Phase 4 UI** — wire the existing verify/vote endpoints into the quest sheet and scrapbook
2. Reactions on scrapbook photos
3. Cover photo upload on event creation (schema field already exists)
4. Then the future roadmap: teams, GPS/QR quests, push notifications, custom pack authoring — the schema was designed so none of these require a redesign
