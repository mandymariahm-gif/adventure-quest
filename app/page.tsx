import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import LoginForm from "@/components/ui/LoginForm";

export default async function Home() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <header className="text-center">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-fern">
          Adventure Quest
        </p>
        <h1 className="mt-3 text-4xl leading-tight">
          Make the night.<br />
          <span className="text-amber">Keep the memory.</span>
        </h1>
        <p className="mt-4 text-paper/70">
          Draw quests with your friends at the event, snap the proof, and open a
          shared scrapbook when the night ends — like a photo album that builds
          itself.
        </p>
      </header>
      <LoginForm />
      <p className="text-center text-xs text-paper/50">
        Got an invite link? Just open it — we&apos;ll bring you right back to your event
        after you sign in.
      </p>
      <Link href="/offline" className="hidden">offline</Link>
    </main>
  );
}
