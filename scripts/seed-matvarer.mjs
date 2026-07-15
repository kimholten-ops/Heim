/**
 * Seeder matvarer-tabellen fra supabase/seed/matvarer.json.
 * Idempotent: upserter på id, trygt å kjøre flere ganger.
 *
 * Data hentet fra Mattilsynet sin offisielle matvaretabellen-deux-kildekode
 * (github.com/Mattilsynet/matvaretabellen-deux, data/foodcase-food-nb.json +
 * data/foodcase-data-nb.json), Norsk lisens for offentlige data (NLOD) —
 * se https://www.matvaretabellen.no/about-us/ for lisensvilkår.
 *
 * Krever SUPABASE_SERVICE_ROLE_KEY siden matvarer-tabellen ikke har noen
 * insert/update-policy for vanlige klienter (kun SELECT er tillatt).
 *
 * Kjør: node scripts/seed-matvarer.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnvLocal() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Mangler NEXT_PUBLIC_SUPABASE_URL og/eller SUPABASE_SERVICE_ROLE_KEY.\n" +
    "Sett dem i .env.local eller som miljøvariabler før du kjører scriptet."
  );
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const matvarer = JSON.parse(readFileSync(join(ROOT, "supabase/seed/matvarer.json"), "utf-8"));
console.log(`Seeder ${matvarer.length} matvarer…`);

const BATCH = 200;
let done = 0;
for (let i = 0; i < matvarer.length; i += BATCH) {
  const batch = matvarer.slice(i, i + BATCH);
  const { error } = await supabase.from("matvarer").upsert(batch, { onConflict: "id" });
  if (error) {
    console.error(`Feil på batch ${i}-${i + batch.length}:`, error.message);
    process.exit(1);
  }
  done += batch.length;
  console.log(`  ${done}/${matvarer.length}`);
}

console.log("Ferdig.");
