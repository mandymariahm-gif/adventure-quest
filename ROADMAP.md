# Adventure Quest — Product Roadmap

**Vision:** A scrapbook-first party game platform. Free-ish app + quest pack marketplace.
Packs are the product — themed, ready-to-run quest collections with their own look.
Positioning: "the world's most fun disposable camera."

**Status:** Phases 1–10 of the original upgrade are ✅ complete (Aug 2026).
Event lifecycle, Memory Week curation, reactions, stories, awards, adventure score,
final reveal, achievements, regenerated scrapbook (community favorites, My Adventure,
finalized awards), and game modes are all live.

---

## V2.5 — Pack Business Foundation
*The money-maker. Nothing else matters until this works.*

- [ ] **Theme system (build FIRST)** — convert Tailwind fixed tokens (pine, paper, amber,
      ink, fern, lantern) to CSS variables set per-event; packs store palette as JSON.
      Every pack authored after this gets its theme at creation time.
- [ ] Quest pack builder — quests, points, categories, photo requirements, legendary
      quest, cover art, theme
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

- Theme refactor: CSS variables on a wrapper element per event; Tailwind classes unchanged.
- Time capsule generalization requires migrating time_capsules columns to a flexible
  question/answer shape (jsonb or a capsule_answers table).
- Stripe: one-time purchases only. No subscriptions for now.
- Known debt: implicit Supabase FK joins are unreliable — use the explicit two-query
  pattern (see scrapbook page achievements fetch).
