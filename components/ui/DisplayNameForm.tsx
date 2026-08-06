"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function DisplayNameForm({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(false);

  async function save() {
    const supabase = supabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("users").update({ display_name: name.trim() || "Friend" }).eq("id", user.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <label htmlFor="display-name">Display name (what friends see in the scrapbook)</label>
      <div className="flex gap-2">
        <input id="display-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary !px-4" onClick={save}>{saved ? "Saved" : "Save"}</button>
      </div>
    </div>
  );
}
