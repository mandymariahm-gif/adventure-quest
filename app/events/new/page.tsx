"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

interface PackOption { id: string; name: string; description: string | null }

const GAME_MODES = [
  { value: "casual", label: "🍺 Casual", description: "No leaderboard emphasis — just fun" },
  { value: "competitive", label: "🏆 Competitive", description: "Full leaderboard, scores prominent" },
  { value: "memory_maker", label: "📸 Memory Maker", description: "No leaderboard — focus on photos and stories" },
];

export default function NewEvent() {
  const router = useRouter();
  const [packs, setPacks] = useState<PackOption[]>([]);
  const [form, setForm] = useState({
    name: "", location: "", event_date: "", description: "",
    participant_limit: 20, quest_pack_id: "", game_mode: "casual",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabaseBrowser()
      .from("quest_packs").select("id,name,description").eq("is_public", true)
      .then(({ data }) => {
        setPacks(data ?? []);
        if (data?.[0]) setForm((f) => ({ ...f, quest_pack_id: data[0].id }));
      });
  }, []);

  async function createEvent() {
    if (!form.name.trim()) return setError("Give your event a name.");
    if (!form.quest_pack_id) return setError("Choose a quest pack.");
    setSaving(true);
    setError("");
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {