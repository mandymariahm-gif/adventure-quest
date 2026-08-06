// Seeds the "Brew at the Zoo" quest pack into your Supabase database.
// Usage:  npm run seed
// Reads .env.local for NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// tiny .env.local loader (no extra dependency needed)
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const pack = JSON.parse(readFileSync(resolve(process.cwd(), "quest-packs/brew-at-the-zoo.json"), "utf8"));

const { data: existing } = await supabase
  .from("quest_packs").select("id").eq("name", pack.name).maybeSingle();

if (existing) {
  console.log(`Quest pack "${pack.name}" already exists (${existing.id}). Nothing to do.`);
  process.exit(0);
}

const { data: created, error: packErr } = await supabase
  .from("quest_packs")
  .insert({ name: pack.name, description: pack.description, version: pack.version, is_public: pack.is_public })
  .select("id").single();
if (packErr) { console.error(packErr); process.exit(1); }

const rows = pack.quests.map((q) => ({
  quest_pack_id: created.id,
  title: q.title,
  description: q.description ?? null,
  category: q.category ?? "general",
  points: q.points ?? 10,
  is_legendary: q.is_legendary ?? false,
  requires_photo: q.requires_photo ?? false,
  requires_verification: q.requires_verification ?? false,
  requires_voting: q.requires_voting ?? false,
}));

const { error: questErr } = await supabase.from("quests").insert(rows);
if (questErr) { console.error(questErr); process.exit(1); }

console.log(`Seeded "${pack.name}" with ${rows.length} quests. Pack id: ${created.id}`);
