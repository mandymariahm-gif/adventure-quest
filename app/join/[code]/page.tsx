import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import LoginForm from "@/components/ui/LoginForm";

export const dynamic = "force-dynamic";

/** Invite deep link. Signed out → magic-link form that returns here.
 *  Signed in → join the event server-side and go straight to the board. */
export default async function JoinPage({ params }: { params: { code: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = supabaseAdmin();
  const { data: event } = await admin
    .from("events")
    .select("id, name, location, event_date, status, participant_limit")
    .eq("invite_code", params.code)
    .maybeSingle();

  if (!event) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-3xl">Invite not found</h1>
        <p className="text-paper/70">
          This invite code doesn&apos;t match an event. Double-check the link with your host.
        </p>
        <Link href="/" className="btn-primary">Go home</Link>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
        <div className="text-center">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-fern">You&apos;re invited</p>
          <h1 className="mt-2 text-3xl">{event.name}</h1>
          <p className="mt-1 text-paper/70">
            {event.event_date ?? ""}{event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
        <LoginForm next={`/join/${params.code}`} />
      </main>
    );
  }

  // join (idempotent) then head to the board
  const { count } = await admin
    .from("event_participants")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id);
  const { data: existing } = await admin
    .from("event_participants")
    .select("id")
    .eq("event_id", event.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    if ((count ?? 0) >= event.participant_limit) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
          <h1 className="text-3xl">Event is full</h1>
          <p className="text-paper/70">Ask the host to raise the participant limit.</p>
          <Link href="/dashboard" className="btn-primary">Go to dashboard</Link>
        </main>
      );
    }
    await admin.from("event_participants").insert({ event_id: event.id, user_id: user.id, role: "participant" });
  }

  const destination = event.status === "ended" ? `/scrapbook/${event.id}` : `/quests/${event.id}`;

return (
  <script
    dangerouslySetInnerHTML={{
      __html: `window.location.replace(${JSON.stringify(destination)})`,
    }}
  />
);
}
