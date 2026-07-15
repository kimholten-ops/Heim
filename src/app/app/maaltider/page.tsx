import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { aiEnabled } from "@/lib/ai";
import MaaltiderClient from "./MaaltiderClient";

export default async function MaaltiderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("active_household_id").eq("id", user.id).maybeSingle();
  const hid = profile?.active_household_id ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recipes: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let meals: any[] = [];

  if (hid) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 13); // 2 weeks ahead

    const [{ data: r }, { data: m }] = await Promise.all([
      supabase.from("recipes").select("id, title, body, url, image_url, servings, total_time_minutes, ingredients, times_used")
        .eq("household_id", hid).order("times_used", { ascending: false }),
      supabase.from("meals").select("id, date, title, cook_id, notes, recipe_id")
        .eq("household_id", hid)
        .gte("date", weekStart.toISOString().split("T")[0])
        .lte("date", weekEnd.toISOString().split("T")[0]),
    ]);
    recipes = r ?? [];
    meals = m ?? [];
  }

  return <MaaltiderClient householdId={hid} initialRecipes={recipes} initialMeals={meals} aiEnabled={aiEnabled()} />;
}
