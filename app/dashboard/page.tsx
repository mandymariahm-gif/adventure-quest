import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";
import InviteCodeInput from "@/components/ui/InviteCodeInput";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: memberships } = await supabase
    .from("event_participants")
    .select("event_id, role")
    .eq("user_id", user.id);

  const eventIds = (memberships ?? []).map((m) => m.event_id);
  const { data: events } = eventIds.length
    ? await supabase.from("events").select("*").in("id", eventIds).order("created_at", { ascending: false })
    : { data: [] as EventRow[] };

  const current = (events ?? []).filter((e) => e.status !== "ended");
  const past = (events ?? []).filter((e) => e.status === "ended");
  const roleFor = (id: string) => memberships?.find((m) => m.event_id === id)?.role;

  return (
    <main className="mx-auto max-w-md p-5 pb-24">
      <header className="flex items-center justify-between py-3">
        <h1 className="text-2xl">Adventure Quest</h1>
        <Link href="/profile" className="btn-ghost !min-h-[40px] !px-4 text-sm">Profile</Link>
      </header>

      {user.id === process.env.NEXT_PUBLIC_HOST_USER_ID && (
        <Link href="/events/new" className="btn-primary w-full">+ Create new event</Link>
      )}

      <section className="mt-8">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-fern">My events</h2>

        {/* ✅ FIX #5 — empty state now has an invite code input so participants aren't stuck */}
        {current.length === 0 && (
          <>
            <p className="mt-3 text-sm text-paper/60">
              No events yet — join one with an invite link from your host.
            </p>
            <InviteCodeInput />
          </>
        )}

        <ul className="mt-3 flex flex-col gap-3">
          {current.map((e) => (
            <li key={e.id} className="ticket p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg leading-tight">{e.name}</p>
                  <p className="mt-1 text-sm text-ink/60">
                    {e.event_date ?? "Date TBD"}{e.location ? ` · ${e.location}` : ""}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-ink/50">
                    {e.status === "active" ? "● Live now" : "Draft"}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {roleFor(e.id) === "host" && (
                    <Link href={`/events/${e.id}/manage`} className="btn-paper !min-h-[40px] !px-4 text-sm">Manage</Link>
                  )}
                  {e.status === "active" && (
                    <Link href={`/quests/${e.id}`} className="btn-primary !min-h-[40px] !px-4 text-sm">Play</Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-fern">
          Past events → scrapbooks
        </h2>
        {past.length === 0 && (
          <p className="mt-3 text-sm text-paper/60">
            Your finished events will live here as scrapbooks.
          </p>
        )}
        <ul className="mt-3 flex flex-col gap-3">
          {past.map((e) => (
            <li key={e.id}>
              <Link href={`/scrapbook/${e.id}`} className="ticket block p-4">
                <p className="font-display text-lg">{e.name}</p>
                <p className="text-sm text-ink/60">{e.event_date ?? ""} · Open scrapbook →</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
