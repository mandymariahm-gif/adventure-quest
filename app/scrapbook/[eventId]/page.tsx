import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import type { ScrapbookStats } from "@/lib/types";
import TimeCapsuleCard from "@/components/scrapbook/TimeCapsuleCard";
import ShareButton from "@/components/scrapbook/ShareButton";
import CurationPanel from "@/components/scrapbook/CurationPanel";
import PhotoReactions from "@/components/scrapbook/PhotoReactions";
import PhotoStory from "@/components/scrapbook/PhotoStory";
import CommunityAwards from "@/components/scrapbook/CommunityAwards";
import { getEventPermissions, formatTimeRemaining } from "@/lib/event-permissions";
import AchievementBadges from "@/components/scrapbook/AchievementBadges";
import RegenerateButton from "@/components/scrapbook/RegenerateButton";
import ThemeProvider from "@/components/ThemeProvider";

export const dynamic = "force-dynamic";

export default async function ScrapbookPage({ params }: { params: { eventId: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = supabaseAdmin();
  const { data: membership } = await admin
    .from("event_participants").select("id, role")
    .eq("event_id", params.eventId).eq("user_id", user.id).maybeSingle();
  if (!membership) redirect("/dashboard");

  const { data: event } = await admin
    .from("events").select("name, location, event_date, status, cover_photo_url, curation_ends_at, host_id, game_mode")
    .eq("id", params.eventId).single();
  if (!event) redirect("/dashboard");

  const isHost = event.host_id === user.id;
  const perms = getEventPermissions(event.status, event.curation_ends_at, isHost);

  if (event.status === "draft" || event.status === "active") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-3xl">Still being written</h1>
        <p className="text-paper/70">The scrapbook assembles itself the moment the host ends the event. Until then — go make pages for it.</p>
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
        <p className="text-paper/70">This usually takes less than a minute — refresh in a moment.</p>
        <Link href={`/scrapbook/${params.eventId}`} className="btn-primary">Refresh</Link>
        <Link href="/dashboard" className="btn-ghost">Back to dashboard</Link>
      </main>
    );
  }

  const stats = (scrapbook.stats_json ?? null) as ScrapbookStats | null;



  const { data: capsule } = await admin
    .from("time_capsules").select("id, unlock_at, favorite_beer, favorite_brewery, funniest_moment, biggest_surprise, favorite_animal, prediction_next_year, personal_goal")
    .eq("event_participant_id", membership.id).maybeSingle();

  // Side quests
  const { data: sideQuestsRaw } = await admin
    .from("side_quests").select("id, title, photo_url, user_id, created_at")
    .eq("event_id", params.eventId).order("created_at", { ascending: true });
  const sideQuestUserIds = (sideQuestsRaw ?? []).map((s: any) => s.user_id);
  const { data: sqUsers } = sideQuestUserIds.length > 0
    ? await admin.from("users").select("id, display_name").in("id", sideQuestUserIds)
    : { data: [] };
  const sqUserMap = new Map((sqUsers ?? []).map((u: any) => [u.id, u.display_name ?? "Someone"]));
  const sideQuests = (sideQuestsRaw ?? []).map((s: any) => ({ ...s, display_name: sqUserMap.get(s.user_id) ?? "Someone" }));

  // Curation data
  let missingPhotoQuests: { completionId: string; questTitle: string }[] = [];
  let activeQuests: { pquestId: string; questTitle: string; requiresPhoto: boolean }[] = [];
  if (perms.isCurationOpen) {
    const { data: myPquests } = await admin
      .from("participant_quests")
      .select("id, status, quests(title, requires_photo), quest_completions(id, photo_url)")
      .eq("event_participant_id", membership.id);
    missingPhotoQuests = (myPquests ?? [])
      .filter((pq: any) => { const c = Array.isArray(pq.quest_completions) ? pq.quest_completions[0] : pq.quest_completions; return pq.status === "completed" && c && !c.photo_url; })
      .map((pq: any) => { const c = Array.isArray(pq.quest_completions) ? pq.quest_completions[0] : pq.quest_completions; return { completionId: c.id, questTitle: pq.quests?.title ?? "Quest" }; });
    activeQuests = (myPquests ?? [])
      .filter((pq: any) => pq.status === "active" || pq.status === "locked")
      .map((pq: any) => ({ pquestId: pq.id, questTitle: pq.quests?.title ?? "Quest", requiresPhoto: pq.quests?.requires_photo ?? false }));
  }

  // Reactions & stories
  const { data: allReactions } = await admin.from("photo_reactions").select("id, photo_id, photo_type, user_id, reaction_type").eq("event_id", params.eventId);
  const reactions = allReactions ?? [];
  const { data: allStoriesRaw } = await admin.from("photo_stories").select("id, photo_id, photo_type, user_id, story_text, users(display_name)").eq("event_id", params.eventId).order("created_at", { ascending: true });
  const allStories = (allStoriesRaw ?? []) as any[];

  // Phase 5 — participants for awards voting
  const { data: participantsRaw } = await admin
    .from("event_participants")
    .select("user_id, curation_points, users(display_name)")
    .eq("event_id", params.eventId);
  const participants = (participantsRaw ?? []).map((p: any) => ({
    user_id: p.user_id,
    display_name: p.users?.display_name ?? "Someone",
    curation_points: p.curation_points ?? 0,
  }));

  // Phase 8 — achievements (explicit two-query join)
  const { data: userAchievementsRaw } = await admin
    .from("user_achievements")
    .select("achievement_id, earned_at")
    .eq("user_id", user.id);

  const achievementIds = (userAchievementsRaw ?? []).map((ua: any) => ua.achievement_id);

  const myAchievements = await (async () => {
    if (achievementIds.length === 0) return [];
    const { data: achievementData } = await admin
      .from("achievements")
      .select("id, code, name, icon, description")
      .in("id", achievementIds);
    const achievementMap = new Map((achievementData ?? []).map((a: any) => [a.id, a]));
    return (userAchievementsRaw ?? []).map((ua: any) => {
      const a = achievementMap.get(ua.achievement_id);
      return {
        code: a?.code ?? "",
        name: a?.name ?? "",
        icon: a?.icon ?? null,
        description: a?.description ?? null,
        earned_at: ua.earned_at,
      };
    }).filter((a: any) => a.code !== "");
  })();

  // Phase 9 — my adventure + community favorites + finalized awards
  const myAdventure = stats?.my_adventures?.find((a) => a.user_id === user.id) ?? null;
  const communityPhotos = stats?.community_photos ?? [];
  const finalizedAwards = stats?.finalized_awards ?? [];

  // Phase 10 — game mode
  const gameMode = (event as any).game_mode ?? "casual";
  const showLeaderboard = gameMode !== "memory_maker";

  const photos = stats?.timeline.filter((t) => t.photo_url) ?? [];
  const champion = stats?.leaderboard[0];
  const tilts = ["-2.5deg", "1.5deg", "-1deg", "2.5deg", "-1.8deg", "1deg"];
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const timeRemaining = perms.msRemaining && perms.msRemaining > 0 ? formatTimeRemaining(perms.msRemaining) : null;

  return (
    <ThemeProvider theme={null}>
    <main className="mx-auto max-w-md bg-paper text-ink">
      {event.status === "curation" && (
        <div className="bg-fern/20 border-b border-fern/30 px-5 py-3 text-center">
          <p className="font-display text-xs uppercase tracking-[0.25em] text-fern">📸 Memory Week</p>
          <p className="mt-0.5 text-xs text-ink/60">{timeRemaining ? `⏳ ${timeRemaining} to add photos and memories` : "Memory Week is ending soon…"}</p>
        </div>
      )}
      {event.status === "locked" && (
        <div className="bg-ink/5 border-b border-ink/10 px-5 py-3 text-center">
          <p className="font-display text-xs uppercase tracking-[0.25em] text-ink/50">🔒 Adventure Complete</p>
          <p className="mt-0.5 text-xs text-ink/40">Memory Week has ended. This scrapbook is now final.</p>
        </div>
      )}

      <header className="bg-pine px-5 pb-10 pt-8 text-center text-paper">
        <p className="font-display text-xs uppercase tracking-[0.35em] text-fern">The scrapbook</p>
        <h1 className="mt-2 text-4xl leading-tight">{event.name}</h1>
        <p className="mt-2 text-paper/70">{event.event_date ?? ""}{event.location ? ` · ${event.location}` : ""}</p>
      </header>

      <section className="ticket -mt-6 mx-5 grid grid-cols-3 gap-2 p-4 text-center">
        <div><p className="font-display text-2xl">{stats?.total_completions ?? 0}</p><p className="text-[11px] uppercase tracking-wide text-ink/50">Quests</p></div>
        <div><p className="font-display text-2xl">{stats?.total_photos ?? 0}</p><p className="text-[11px] uppercase tracking-wide text-ink/50">Photos</p></div>
        <div><p className="font-display text-2xl">{stats?.participant_count ?? 0}</p><p className="text-[11px] uppercase tracking-wide text-ink/50">Friends</p></div>
      </section>

      {champion && showLeaderboard && (
        <section className="mx-5 mt-6 rounded-xl bg-amber/20 p-4 text-center">
          <p className="font-display text-sm uppercase tracking-[0.25em] text-ink/60">Champion</p>
          <p className="mt-1 font-display text-2xl">🏆 {champion.display_name}</p>
          <p className="text-sm text-ink/60">{champion.points} points</p>
        </section>
      )}

      {perms.isCurationOpen && (
        <CurationPanel eventId={params.eventId} missingPhotoQuests={missingPhotoQuests} activeQuests={activeQuests} canAddSideQuest={perms.canAddSideQuest} />
      )}

      {/* Phase 9 — My Adventure (locked only) */}
      {myAdventure && event.status === "locked" && (
        <section className="mt-8 mx-5 rounded-xl bg-pine/10 border border-pine/20 p-4" aria-label="My Adventure">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">✨ My Adventure</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-display text-2xl text-amber">{myAdventure.total_points}</p>
              <p className="text-[11px] uppercase tracking-wide text-ink/50">Total pts</p>
            </div>
            <div>
              <p className="font-display text-2xl">{myAdventure.quests_completed}</p>
              <p className="text-[11px] uppercase tracking-wide text-ink/50">Quests</p>
            </div>
            <div>
              <p className="font-display text-2xl">{myAdventure.photos_taken}</p>
              <p className="text-[11px] uppercase tracking-wide text-ink/50">Photos</p>
            </div>
          </div>
          {myAdventure.best_photo_url && (
            <div className="mt-4">
              <p className="text-xs text-ink/40 mb-2">Your most-loved photo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={myAdventure.best_photo_url} alt="Your best photo" className="w-full rounded-lg object-cover max-h-48" loading="lazy" />
              {myAdventure.best_photo_reactions > 0 && (
                <p className="mt-1 text-xs text-ink/40 text-center">{myAdventure.best_photo_reactions} reactions</p>
              )}
            </div>
          )}
          {myAdventure.awards_won.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-ink/40 mb-1">Awards won</p>
              <div className="flex flex-wrap gap-1">
                {myAdventure.awards_won.map((a, i) => (
                  <span key={i} className="text-xs bg-amber/20 border border-amber/30 rounded-full px-2 py-0.5">
                    {a.emoji} {a.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Phase 9 — Community Favorites (locked) */}
      {communityPhotos.length > 0 && event.status === "locked" && (
        <section className="mt-8 px-5" aria-label="Community favorites">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">❤️ Community favorites</h2>
          <p className="mt-1 text-xs text-ink/40">Your most-reacted photos from the night</p>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8">
            {communityPhotos.map((p, i) => (
              <div key={i} className="flex flex-col">
                <figure className="polaroid relative" style={{ ["--tilt" as never]: tilts[i % tilts.length] }}>
                  <span className="tape" aria-hidden />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.photo_url} alt={`${p.display_name} — ${p.quest_title}`} loading="lazy" />
                  <figcaption className="polaroid-caption">{p.quest_title}</figcaption>
                </figure>
                {p.reaction_count > 0 && (
                  <p className="mt-1 text-center text-xs text-ink/40">{p.reaction_count} reactions</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All photos — curation view with reactions/stories */}
      {photos.length > 0 && event.status !== "locked" && (
        <section className="mt-8 px-5" aria-label="Photos">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">The pages</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8">
            {photos.map((p, i) => {
              const photoId = p.photo_url ?? `${p.display_name}-${p.quest_title}`;
              return (
                <div key={i} className="flex flex-col">
                  <figure className="polaroid relative" style={{ ["--tilt" as never]: tilts[i % tilts.length] }}>
                    <span className="tape" aria-hidden />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.photo_url!} alt={`${p.display_name} — ${p.quest_title}`} loading="lazy" />
                    <figcaption className="polaroid-caption">{p.quest_title}{p.text_note ? ` — "${p.text_note}"` : ""}</figcaption>
                  </figure>
                  <PhotoReactions photoId={photoId} photoType="completion" eventId={params.eventId} currentUserId={user.id} allReactions={reactions} canReact={perms.canVote} />
                  <PhotoStory photoId={photoId} photoType="completion" eventId={params.eventId} currentUserId={user.id} allStories={allStories} canAddStory={perms.canAddStory} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* All photos — locked view (read-only) */}
      {photos.length > 0 && event.status === "locked" && (
        <section className="mt-8 px-5" aria-label="All photos">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">The pages</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8">
            {photos.map((p, i) => (
              <div key={i} className="flex flex-col">
                <figure className="polaroid relative" style={{ ["--tilt" as never]: tilts[i % tilts.length] }}>
                  <span className="tape" aria-hidden />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.photo_url!} alt={`${p.display_name} — ${p.quest_title}`} loading="lazy" />
                  <figcaption className="polaroid-caption">{p.quest_title}{p.text_note ? ` — "${p.text_note}"` : ""}</figcaption>
                </figure>
              </div>
            ))}
          </div>
        </section>
      )}

      {sideQuests && sideQuests.length > 0 && (
        <section className="mt-10 px-5" aria-label="Spontaneous moments">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">📸 Spontaneous moments</h2>
          <p className="mt-1 text-xs text-ink/40">Side quests from the night</p>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8">
            {sideQuests.filter((s: any) => s.photo_url).map((s: any, i: number) => (
              <div key={s.id} className="flex flex-col">
                <figure className="polaroid relative" style={{ ["--tilt" as never]: tilts[i % tilts.length] }}>
                  <span className="tape" aria-hidden />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.photo_url} alt={s.title} loading="lazy" />
                  <figcaption className="polaroid-caption">{s.title} — {s.display_name}</figcaption>
                </figure>
                {event.status !== "locked" && (
                  <>
                    <PhotoReactions photoId={s.id} photoType="side_quest" eventId={params.eventId} currentUserId={user.id} allReactions={reactions} canReact={perms.canVote} />
                    <PhotoStory photoId={s.id} photoType="side_quest" eventId={params.eventId} currentUserId={user.id} allStories={allStories} canAddStory={perms.canAddStory} />
                  </>
                )}
              </div>
            ))}
          </div>
          {sideQuests.filter((s: any) => !s.photo_url).length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {sideQuests.filter((s: any) => !s.photo_url).map((s: any) => (
                <li key={s.id} className="flex items-start gap-2 text-sm text-ink/70">
                  <span>📸</span><span><strong>{s.display_name}</strong> — {s.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Phase 5 — Community Awards voting (during curation) */}
      {(perms.canVote || !perms.isCurationOpen) && participants.length > 1 && (
        <CommunityAwards
          eventId={params.eventId}
          currentUserId={user.id}
          participants={participants}
          canVote={perms.canVote}
        />
      )}

      {/* Phase 9 — Finalized awards (locked only) */}
      {finalizedAwards.length > 0 && event.status === "locked" && (
        <section className="mt-8 px-5" aria-label="Awards">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">🏅 Awards</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {finalizedAwards.map((a, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-amber/10 px-3 py-2 text-sm">
                <span>{a.award_emoji} {a.award_label}</span>
                <span className="font-display text-ink/70">{a.winner_display_name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {/* Phase 10 — leaderboard hidden for memory_maker */}
      {stats && stats.leaderboard.length > 1 && showLeaderboard && (
        <section className="mt-8 px-5" aria-label="Final standings">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink/50">Adventure Score</h2>
          <p className="mt-1 text-xs text-ink/40">Quest points + Memory Week bonus</p>
          <ol className="mt-2">
            {stats.leaderboard.map((l, i) => {
              const ep = participants.find((p) => p.user_id === l.user_id) as any;
              const curationPts = ep?.curation_points ?? 0;
              const total = l.points + curationPts;
              return (
                <li key={l.user_id} className="flex justify-between border-b border-ink/10 py-2 text-sm">
                  <span>{i + 1}. {l.display_name}</span>
                  <span className="text-right">
                    <span className="font-display text-amber">{total} pts</span>
                    {curationPts > 0 && (
                      <span className="ml-1 text-xs text-ink/40">(+{curationPts} memory)</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="mt-10 px-5 pb-6" aria-label="Time capsule">
        <TimeCapsuleCard eventParticipantId={membership.id} existing={capsule ?? null} />
      </section>

      {/* Phase 8 — Achievement Badges */}
      {myAchievements.length > 0 && (
        <AchievementBadges achievements={myAchievements} displayName="My" />
      )}

      <footer className="flex flex-col gap-3 bg-pine px-5 py-8 text-center text-paper">
        {isHost && (event.status === "locked" || event.status === "curation") && (
          <RegenerateButton eventId={params.eventId} />
        )}
        <ShareButton title={`${event.name} — our scrapbook`} />
        <Link href="/dashboard" className="btn-ghost">Back to dashboard</Link>
        <p className="text-xs text-paper/40">Made together. See you next year.</p>
      </footer>
    </main>
    </ThemeProvider>
  );
}
