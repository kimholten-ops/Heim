import { redirect } from "next/navigation";

// Middleware sender uinnloggede til /login. Innloggede går til /app.
export default function Home() {
  redirect("/app");
}
