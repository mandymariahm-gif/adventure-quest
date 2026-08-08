import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import type { ScrapbookStats } from "@/lib/types";
import TimeCapsuleCard from "@/components/scrapbook/TimeCapsuleCard";
import ShareButton from "@/components/scrapbook/ShareButton";

export const dynamic = "force-dynamic";

export default async function ScrapbookPage({ params }: { params: { eventId: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = supabaseAdmin();
  const { data: membership } = await admin
    .from("event_participants").select("id")
    .eq("event_id", params.eventId).eq("user_id", user.id).maybeSingle();
  if (!membership) redirect("/dashboard");

  const { data: event } = await admin
    .from("events").select("name, location, event_date, status, cover_photo_url")
    .eq("id", params.eventId).single();

  if (!event) redirect("/dashboard");

  if (event.status !== "ended") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-3xl">Still being written</h1>
        <p className="text-paper/70">
          The scrapbook assembles itself the moment the host ends the event.
          Until then — go make pages for it.
        </p>
        <Link href={`/quests/${params.eventId}`} className="btn-primary">Back to quests</Link>
      </main>
    );
  }

  const { data: scrapbook } = await admin
    .from("scrapbooks").select("stats_json, champion_user_id, generated_at")
    .eq("event_id", params.eventId).maybeSingle();

  if (!scrapbook) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-3xl">Assembling your scrapbook…</h1>
        <p className="text-paper/70">
          The night is being gathered into pages. This usually takes less than a
          minute — refresh in a moment and it'll be ready.
        </p>
        <Link href={`/scrapbook/${params.eventId}`} className="btn-primary">Refresh</Link>
        <Link href="/dashboard" className="btn-ghost">Back to dashboard</Link>
      </main>
    );
  }

  const stats = (scrapbook.stats_json ?? null) as ScrapbookStats | null;

  const { data: capsule } = await admin
    .from("time_capsules").select("id, unlock_at, favorite_beer, favorite_brewery, funniest_moment, biggest_surprise, favorite_animal, prediction_next_year, personal_goal")
    .eq("event_participant_id", membership.id).maybeSingle();

  // ✅ Fetch side quests for "Spontaneous Moments" section
  const { data: sideQuestsRaw } = await admin
    .from("side_quests")
    .select("id, title, photo_url, user_id, created_at")
    .eq("event_id", params.eventId)
    .order("created_at", { ascending: true });

  // Fetch display names separately
  const sideQuestUserIds = (sideQuestsRaw ?? []).map((s: any) => s.user_id);
  const { data: sqUsers } = sideQuestUserIds.length > 0
    ? await admin.from("users").select("id, display_name").in("id", sideQuestUserIds)
    : { data: [] };
  const sqUserMap = new Map((sqUsers ?? []).map((u: any) => [u.id, u.display_name ?? "Someone"]));
  const sideQuests = (sideQuestsRaw ?? []).map((s: any) => ({
    ...s,
    display_name: sqUserMap.get(s.user_id) ?? "Someone",
  }));

  const photos = stats?.timeline.filter((t) => t.photo_url) ?? [];
  const champion = stats?.leaderboard[0];
  const tilts = ["-2.5deg", "1.5deg", "-1deg", "2.5deg", "-1.8deg", "1deg"];

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <main className="mx-auto max-w-md bg-paper text-ink">
      {/* cover */}
      <header className="bg-pine px-5 pb-10 pt-8 text-center text-paper">
        <p className="font-display text-xs uppercase tracking-[0.35em] text-fern">The scrapbook</p>
        <h1 className="mt-2 text-4xl leading-tight">{event.name}</h1>
        <p className="mt-2 text-paper/70">
          {event.event_date ?? ""}{event.location ? ` · ${event.location}` : ""}
        </p>
      </header>

      {/* stats strip */}
      <section className="ticket -mt-6 mx-5 grid grid-cols-3 gap-2 p-4 text-center">
        <div>
          <p className="font-display text-2xl">{stats?.total_completions ?? 0}</p>
          <p className="text-[11px] uppercase tracking-wide text-ink/50">Quests</p>
        </div>
        <div>
          <p className="font-display text-2xl">{stats?.total_photos ?? 0}</p>
          <p className="text-[11px] uppercase tracking-wide text-ink/50">Photos</p>
        </div>
        <div>
          <p className="font-display text-2xl">{stats?.participant_count ?? 0}</p>
          <p className="text-[11px] uppercase tracking-wide text-ink/50">Friends</p>
        </div>
      </section>

      {/* champion */}
      {champion && (
        <section className="mx-5 mt-6 rounded-xl bg-amber/20 p-4 text-center">
          <p className="font-display text-sm uppercase tracking-[0.25em] text-ink/60">Champion</p>
          <p className="mt-1 font-display text-2xl">🏆 {champion.display_name}</p>
          <p className="text-sm text-ink/60">{champion.points} points</p>
        </section>
      )}

      {/* photo grid */}
      {photos.length > 0 && (
        <section className="mt-8 px-5" aria-label="Photos">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">The pages</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8">
            {photos.map((p, i) => (
              <figure key={i} className="polaroid relative" style={{ ["--tilt" as never]: tilts[i % tilts.length] }}>
                <span className="tape" aria-hidden />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photo_url!} alt={`${p.display_name} — ${p.quest_title}`} loading="lazy" />
                <figcaption className="polaroid-caption">
                  {p.quest_title}
                  {p.text_note ? ` — "${p.text_note}"` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ✅ Spontaneous moments — side quests */}
      {sideQuests && sideQuests.length > 0 && (
        <section className="mt-10 px-5" aria-label="Spontaneous moments">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">📸 Spontaneous moments</h2>
          <p className="mt-1 text-xs text-ink/40">Side quests from the night</p>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8">
            {sideQuests.filter((s: any) => s.photo_url).map((s: any, i: number) => (
              <figure key={s.id} className="polaroid relative" style={{ ["--tilt" as never]: tilts[i % tilts.length] }}>
                <span className="tape" aria-hidden />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.photo_url} alt={s.title} loading="lazy" />
                <figcaption className="polaroid-caption">
                  {s.title}
                  {s.display_name ? ` — ${s.users.display_name}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
          {/* Show text-only side quests */}
          {sideQuests.filter((s: any) => !s.photo_url).length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {sideQuests.filter((s: any) => !s.photo_url).map((s: any) => (
                <li key={s.id} className="flex items-start gap-2 text-sm text-ink/70">
                  <span>📸</span>
                  <span><strong>{s.display_name ?? "Someone"}</strong> — {s.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* timeline */}
      {stats && stats.timeline.length > 0 && (
        <section className="mt-10 px-5" aria-label="Timeline">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">How the night went</h2>
          <ol className="mt-3 border-l-2 border-ink/15 pl-4">
            {stats.timeline.map((t, i) => (
              <li key={i} className="relative mb-3">
                <span className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full bg-amber" aria-hidden />
                <p className="text-sm">
                  <span className="text-ink/50">{fmtTime(t.completed_at)}</span>{" "}
                  <strong>{t.display_name}</strong> — {t.is_legendary ? "⭐ " : ""}{t.quest_title}
                  <span className="text-ink/50"> · {t.points} pts</span>
                </p>
                {t.text_note && <p className="text-sm italic text-ink/60">"{t.text_note}"</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* leaderboard */}
      {stats && stats.leaderboard.length > 1 && (
        <section className="mt-8 px-5" aria-label="Final standings">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">Final standings</h2>
          <ol className="mt-2">
            {stats.leaderboard.map((l, i) => (
              <li key={l.user_id} className="flex justify-between border-b border-ink/10 py-2 text-sm">
                <span>{i + 1}. {l.display_name}</span>
                <span className="text-ink/60">{l.points} pts</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* time capsule */}
      <section className="mt-10 px-5 pb-6" aria-label="Time capsule">
        <TimeCapsuleCard
          eventParticipantId={membership.id}
          existing={capsule ?? null}
        />
      </section>

      <footer className="flex flex-col gap-3 bg-pine px-5 py-8 text-center text-paper">
        <ShareButton title={`${event.name} — our scrapbook`} />
        <Link href="/dashboard" className="btn-ghost">Back to dashboard</Link>
        <p className="text-xs text-paper/40">Made together. See you next year.</p>
      </footer>
    </main>
  );
}
