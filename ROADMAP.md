# Adventure Quest — Product Roadmap

**Vision:** A scrapbook-first party game platform. Free-ish app + quest pack marketplace.
Packs are the product — themed, ready-to-run quest collections with their own look.
Positioning: "the world's most fun disposable camera."

**Status:** Phases 1–10 of the original upgrade ✅ complete (Aug 2026).
Event lifecycle, Memory Week curation, reactions, stories, awards, adventure score,
final reveal, achievements, regenerated scrapbook (community favorites, My Adventure,
finalized awards), and game modes are all live.

---

## 👉 NEXT SESSION STARTS HERE

**Building:** V2.5 → Quest Pack Builder (the big one).
**First move:** paste the `quest_packs` and `quests` table schemas so the builder form
can be designed around the real data. Get them with:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'quest_packs' ORDER BY ordinal_position;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'quests' ORDER BY ordinal_position;
```

The builder needs: pack info (name, description, cover art), a quest editor
(add / remove / reorder quests with points, category, photo-required, legendary flag),
a theme picker (theme system already exists — see below), and API routes to save it all.
Design note for the theme picker: it should show a live preview and flag low contrast
(paper must contrast against pine — the header is light text on a dark banner).

---

## V2.5 — Pack Business Foundation
*The money-maker. Nothing else matters until this works.*

- [x] **Theme system** — palette converted to CSS variables (RGB channels); `theme_json`
      column on quest_packs; ThemeProvider component (components/ThemeProvider.tsx) wraps
      pages and fills the viewport with the themed background. Proven with a Halloween
      reskin, then reverted to default. Ready for the pack builder to assign real themes.
- [ ] **Quest pack builder** ← NEXT — quests, points, categories, photo requirements,
      legendary quest, cover art, theme picker (with live preview + contrast check)
- [ ] Configurable award categories per pack (replaces hardcoded beer awards)
- [ ] Configurable time capsule questions per pack (schema migration — current columns
      are literally favorite_beer / favorite_brewery)
- [ ] `is_premium` + price on quest_packs; `pack_purchases` table
- [ ] Stripe one-time purchases + access gating on event creation
- [ ] Pack storefront — browse, preview sample quests, theme swatches on pack cards

**Launch catalog ideas:** bachelorette/bachelor, birthday bar crawl, zoo/museum/aquarium
day, Halloween 🎃, family reunion, office team-building (price higher), road trip,
holiday party. Seasonal packs = natural recurring releases.

## V3 — Frictionless Participation & Share Loop
*Every scrapbook share is the marketing.*

- [ ] Guest mode — stunning read-only scrapbook view (the acquisition page)
- [ ] Public signup links (strangers join, not just friends with a code)
- [ ] Branded OG images — event name, cover photo, stats on ticket motif
- [ ] Instagram Story export — vertical pack-themed "My Adventure" card
- [ ] Organizer onboarding wizard + teaching empty states
- [ ] Landing/marketing page with pack catalog front and center
- [ ] Participant management + photo moderation (strangers upload now)
- [ ] RLS hardening for true multi-tenant isolation

## V3.5 — Engagement, Retention & Physicality

- [ ] Email notifications via Resend (next-morning scrapbook delivery)
- [ ] Push notifications for live activity during events
- [ ] Extend curation window button for host
- [ ] Cover photo voting, caption contest, quote wall
- [ ] Scrapbook physicality pass — torn edges, stamps, handwritten annotations (themed)
- [ ] Game juice pass — completion confetti, "DONE" stamp slam, achievement toasts,
      camera-shutter photo transition
- [ ] Photography-first rehaul — bigger polaroids, photo-forward lobby, disposable-camera
      framing in UI copy
- [ ] Event templates, multiple hosts per event, organizer dashboard

## V4 — Differentiators (paid tier)

- [ ] AI event narrative + participant summaries ("Here's your night...")
- [ ] AI Curator — layout suggestions, highlight picking
- [ ] Interactive flipbook with page-turn animations (pack-themed pages)
- [ ] Print-ready PDF export (theme carries into print; skip Blurb/Lulu fulfillment)
- [ ] Shareable achievement badges

## V5 — Delight & Expansion

- [ ] Team mode, adventure/location mode (game_mode foundation already built)
- [ ] Trading cards (pack-themed frames), annual yearbook, world map with event pins
- [ ] Easter eggs, memory movie auto-recap
- [ ] Memory Hunt challenges, early bird achievement
- [ ] User-created packs sellable in marketplace (rev share) — including user themes

---

## Design principles

1. **The pack is the product; the pack controls the look.** Theme = part of what's bought.
2. **Keep the scrapbook physicality.** Polaroids, tape, tickets — it reads as a keepsake,
   not a game. That's what attracts non-gamers.
3. **The share IS the funnel.** Guest view + OG images + Story export before ads, ever.
4. **Juice the game moments** for the players who love games; delight converts the rest.
5. **Photos first everywhere.** Points are the layer underneath, not the headline.

## Technical notes

- Theme: CSS variables are space-separated RGB channels (e.g. `--color-pine: 20 41 31`),
  wrapped in tailwind.config as `rgb(var(--color-pine) / <alpha-value>)` so opacity
  utilities (text-ink/80 etc.) work. Themes pass channel strings to ThemeProvider.
- Theme contrast contract: `paper` must be light against a dark `pine` (header is
  text-paper on bg-pine). The pack builder's theme picker should preview + warn.
- Time capsule generalization requires migrating time_capsules columns to a flexible
  question/answer shape (jsonb or a capsule_answers table).
- Stripe: one-time purchases only. No subscriptions for now.
- Known debt: implicit Supabase FK joins are unreliable — use the explicit two-query
  pattern (see scrapbook page achievements fetch).
- Windows encoding: watch for mangled emoji/em-dashes (ΓÇª etc.) when pasting into files.
