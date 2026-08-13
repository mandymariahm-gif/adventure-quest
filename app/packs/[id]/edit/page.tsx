import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import QuestEditor from "@/components/pack-builder/QuestEditor";
import type { Quest, QuestPack } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditPack({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data } = await supabase
    .from("quest_packs").select("*").eq("id", params.id).maybeSingle();
  const pack = data as QuestPack | null;
  if (!pack) notFound();
  if (pack.owner_id !== user.id) {
    // Not yours — send back to the dashboard rather than showing someone else's draft.
    redirect("/dashboard");
  }

  const { data: questRows } = await supabase
    .from("quests").select("*").eq("quest_pack_id", pack.id)
    .order("position", { ascending: true });
  const quests = (questRows ?? []) as Quest[];

  return (
    <main className="mx-auto max-w-md p-5 pb-24">
      <header className="flex items-center gap-3 py-3">
        <Link href="/dashboard" className="btn-ghost !min-h-[40px] !px-3 text-sm" aria-label="Back">←</Link>
        <div>
          <h1 className="text-2xl">{pack.name}</h1>
          <p className="text-xs uppercase tracking-wide text-paper/50">
            {pack.is_public ? "Published" : "Private draft"}
          </p>
        </div>
      </header>

      <QuestEditor packId={pack.id} initialQuests={quests ?? []} />
    </main>
  );
}
