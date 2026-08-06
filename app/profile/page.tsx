import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import SignOutButton from "@/components/ui/SignOutButton";
import DisplayNameForm from "@/components/ui/DisplayNameForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("users").select("display_name").eq("id", user.id).single();

  const { count: eventsCount } = await admin
    .from("event_participants").select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: completed } = await admin
    .from("participant_quests")
    .select("id, quests(is_legendary, points), event_participants!inner(user_id)")
    .eq("status", "completed")
    .eq("event_participants.user_id", user.id);

  type Row = { quests: { is_legendary: boolean; points: number } | null };
  const rows = (completed ?? []) as unknown as Row[];
  const questsDone = rows.length;
  const legendaries = rows.filter((r) => r.quests?.is_legendary).length;

  const { count: championWins } = await admin
    .from("scrapbooks").select("id", { count: "exact", head: true })
    .eq("champion_user_id", user.id);

  const { data: allAchievements } = await admin
    .from("achievements").select("id, code, name, description, icon").order("code");
  const { data: earned } = await admin
    .from("user_achievements").select("achievement_id").eq("user_id", user.id);
  const earnedSet = new Set((earned ?? []).map((e) => e.achievement_id));

  return (
    <main className="mx-auto max-w-md p-5 pb-24">
      <header className="flex items-center gap-3 py-3">
        <Link href="/dashboard" className="btn-ghost !min-h-[40px] !px-3 text-sm" aria-label="Back">←</Link>
        <h1 className="text-2xl">Profile</h1>
      </header>

      <DisplayNameForm initial={profile?.display_name ?? ""} />

      <section className="mt-6 grid grid-cols-2 gap-3 text-center" aria-label="Stats">
        {[
          [eventsCount ?? 0, "Events"],
          [questsDone, "Quests done"],
          [championWins ?? 0, "Champion wins"],
          [legendaries, "Legendaries"],
        ].map(([n, label]) => (
          <div key={label} className="rounded-xl bg-white/10 p-4">
            <p className="font-display text-3xl">{n}</p>
            <p className="text-xs uppercase tracking-wide text-paper/60">{label}</p>
          </div>
        ))}
      </section>

      <section className="mt-8" aria-label="Achievements">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-fern">Achievements</h2>
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {(allAchievements ?? []).map((a) => {
            const has = earnedSet.has(a.id);
            return (
              <li key={a.id} className={`ticket p-3 ${has ? "" : "opacity-40 grayscale"}`}>
                <p className="text-2xl" aria-hidden>{a.icon}</p>
                <p className="font-display text-sm leading-tight">{a.name}</p>
                <p className="text-xs text-ink/60">{a.description}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-10">
        <SignOutButton />
      </div>
    </main>
  );
}
