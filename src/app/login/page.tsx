import LoginClient from "./LoginClient";

// Krever alltid runtime (ikke prerender ved build): siden lager en Supabase
// browser-klient med NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, som ikke nødvendigvis
// er tilgjengelig i alle deploy-miljøer på build-tidspunktet.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginClient />;
}
