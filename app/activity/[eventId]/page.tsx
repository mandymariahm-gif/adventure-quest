import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import ActivityFeed from "@/components/quest/ActivityFeed";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ params }: { params: { eventId: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = supabaseAdmin();
  const { data: membership } = await admin
    .from("event_participants")
    .select("id")
    .eq("event_id", params.eventId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/dashboard");

  const { data: event } = await admin
    .from("events")
    .select("name, status")
    .eq("id", params.eventId)
    .single();
  if (!event) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-md p-5 pb-28">
      <header className="flex items-center justify-between py-3">
        <div>
          <h1 className="text-xl leading-tight">{event.name}</h1>
          <p className="text-sm text-paper/60">Live activity</p>
        </div>
        <div className="h-2 w-2 rounded-full bg-fern animate-pulse" aria-label="Live" />
      </header>

      <ActivityFeed eventId={params.eventId} />

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-pine/95 backdrop-blur" aria-label="Main">
        <div className="mx-auto flex max-w-md justify-around py-2">
          <Link className="btn-ghost !min-h-[44px] text-sm" href={`/quests/${params.eventId}`}>Quests</Link>
          <span className="btn-ghost !min-h-[44px] !bg-white/15 text-sm">Activity</span>
          <Link className="btn-ghost !min-h-[44px] text-sm" href={`/scrapbook/${params.eventId}`}>Scrapbook</Link>
          <Link className="btn-ghost !min-h-[44px] text-sm" href="/profile">Profile</Link>
        </div>
      </nav>
    </main>
  );
}
