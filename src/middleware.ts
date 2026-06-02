import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Exclude public routes from auth middleware:
    // - static files, images, manifest
    // - /api/ics/* (calendar feed — must be public, iOS sends no auth headers)
    // - /login, /registrer, /privacy, /terms, /roadmap (public pages)
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|api/ics|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
