// Roterende gjøremål: genererer neste runde av en rotasjon som gjøremål,
// og flytter ansvaret videre til neste person i rekkefølgen. Ingen server-
// jobb/cron finnes ennå, så dette kjøres klient-side når Gjøremål-siden
// lastes — derfor er hvert steg skrevet for å være trygt å kalle flere
// ganger (idempotent), også om to familiemedlemmer trigger det samtidig.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type TodoRotation = Database["public"]["Tables"]["todo_rotations"]["Row"];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function advanceDate(iso: string, frequency: "daily" | "weekly"): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + (frequency === "daily" ? 1 : 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function advanceRotation(supabase: SupabaseClient<Database>, rotation: TodoRotation, today: string) {
  const members = rotation.member_order;
  if (members.length === 0) return;

  let currentIndex = rotation.current_index;
  let nextDue = rotation.next_due;
  let guard = 0;

  // Løkke i stedet for ett steg: fanger opp runder som forfalt mens ingen
  // hadde appen åpen (f.eks. en uke uten besøk), i stedet for å hoppe rett
  // til dagens dato og miste mellomliggende runder.
  while (nextDue <= today && guard < 60) {
    guard++;
    const assignee = members[currentIndex % members.length];

    const { error } = await supabase.from("todos").insert({
      todo_list_id: rotation.todo_list_id,
      household_id: rotation.household_id,
      title: rotation.title,
      due_date: nextDue,
      priority: "normal",
      assigned_to: assignee,
      rotation_id: rotation.id,
    });
    // 23505 = unique_violation — et annet familiemedlem rakk å opprette
    // samme runde først. Det er forventet og trygt å ignorere.
    if (error && error.code !== "23505") break;

    currentIndex = (currentIndex + 1) % members.length;
    nextDue = advanceDate(nextDue, rotation.frequency);
  }

  await supabase
    .from("todo_rotations")
    .update({ current_index: currentIndex, next_due: nextDue })
    .eq("id", rotation.id);
}

// Kjøres ved sidelasting: finner alle aktive rotasjoner i husstanden som
// har forfalt, og genererer gjøremål + flytter ansvaret videre for hver.
export async function checkRotations(supabase: SupabaseClient<Database>, householdId: string): Promise<void> {
  const today = todayISO();
  const { data: rotations } = await supabase
    .from("todo_rotations")
    .select("*")
    .eq("household_id", householdId)
    .eq("active", true)
    .lte("next_due", today);

  if (!rotations || rotations.length === 0) return;
  for (const rotation of rotations as TodoRotation[]) {
    await advanceRotation(supabase, rotation, today);
  }
}

// "Hopp over denne runden" — flytter ansvaret videre uten å lage et gjøremål.
export async function skipRotationRound(supabase: SupabaseClient<Database>, rotation: TodoRotation): Promise<void> {
  const members = rotation.member_order;
  if (members.length === 0) return;
  const currentIndex = (rotation.current_index + 1) % members.length;
  const nextDue = advanceDate(rotation.next_due, rotation.frequency);
  await supabase
    .from("todo_rotations")
    .update({ current_index: currentIndex, next_due: nextDue })
    .eq("id", rotation.id);
}
