/**
 * Seeder øvelsesbiblioteket (exercises-tabellen) fra supabase/seed/exercises.json.
 * Idempotent: upserter på id, trygt å kjøre flere ganger.
 *
 * Kurert og oversatt til norsk fra free-exercise-db
 * (https://github.com/yuhonas/free-exercise-db, Unlicense/public domain).
 *
 * Krever SUPABASE_SERVICE_ROLE_KEY siden exercises-tabellen ikke har noen
 * insert/update-policy for vanlige klienter (kun SELECT er tillatt).
 *
 * Kjør: node scripts/seed-exercises.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Enkel .env.local-leser (ingen dotenv-avhengighet) — kun brukt lokalt for
// utviklerens egen kjøring, ikke i produksjon.
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

const exercises = JSON.parse(readFileSync(join(ROOT, "supabase/seed/exercises.json"), "utf-8"));
console.log(`Seeder ${exercises.length} øvelser…`);

const BATCH = 50;
let done = 0;
for (let i = 0; i < exercises.length; i += BATCH) {
  const batch = exercises.slice(i, i + BATCH);
  const { error } = await supabase.from("exercises").upsert(batch, { onConflict: "id" });
  if (error) {
    console.error(`Feil på batch ${i}-${i + batch.length}:`, error.message);
    process.exit(1);
  }
  done += batch.length;
  console.log(`  ${done}/${exercises.length}`);
}

console.log("Ferdig.");
