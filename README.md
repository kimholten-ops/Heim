# Heim – familieplanlegger (Next.js + Supabase)

Webapp med innlogging, **delte husholdninger** og en delt handleliste som synker
i **sanntid**. Grunnmuren du bygger resten på (kalender, gjøremål, måltider, ukepenger).

## Hva som er med
- Next.js (App Router) + TypeScript + Tailwind, med **ekte ruting** (egen URL per skjerm)
- Innlogging/registrering med Supabase Auth
- **Delte husholdninger:** invitasjon med utløp (7 dager) og engangsbruk, bli med, bytt, og **forlat**
- Opprett ny husholdning + pen tom-tilstand når du ikke er med i noen
- Legg til barn (uten egen innlogging)
- Delt handleliste med sanntid og **optimistisk UI** (føles umiddelbart, ruller tilbake ved feil)
- Row Level Security – hver familie ser kun egne data
- **Typesikkerhet** mot databasen via genererte typer
- PWA (installerbar, cacher app-skallet)

---

## Kom i gang (ca. 15 min)

### 1. Forutsetninger
Node.js 20+, en gratis Supabase-konto.

### 2. Opprett Supabase-prosjekt
Nytt prosjekt, **region i EU** (f.eks. Frankfurt).

### 3. Kjør migrasjonene (i rekkefølge)
I Supabase: **SQL Editor → New query**. Kjør filene i `supabase/migrations/`:
1. `0001_init.sql`
2. `0002_shared_households.sql`
3. `0003_invites_and_membership.sql`

> **Vane videre:** hver databaseendring = en ny nummerert fil (`0004_...`) i git.

### 4. Hent nøkler
**Project Settings → API**. Kopier `.env.local.example` til `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 5. (Dev) skru av e-postbekreftelse
**Authentication → Sign In / Providers → Email** → av med "Confirm email" mens du tester.

### 6. Kjør appen
```bash
npm install
npm run dev
```
Åpne http://localhost:3000.

### 7. Test deling i sanntid
Familie → **Generer invitasjon** → kopier koden. I et inkognitovindu: registrer en ny
bruker → Familie → **Bli med** med koden. Åpne **Lister** i begge vinduer og se synkingen.

---

## Typer fra databasen (anbefalt)
Klientene er allerede typet mot `src/types/supabase.ts`. Når du endrer databasen,
regenerer typene fra ditt eget prosjekt (krever Supabase CLI – sett inn prosjekt-ID):
```bash
npm run gen-types
```

## Struktur (etter refaktorering)
- `supabase/migrations/*` – database, RLS, delings-/medlemsfunksjoner.
- `src/app/app/layout.tsx` – laster husholdnings-kontekst én gang, viser bunnmeny, og
  håndterer tom tilstand (`NoHousehold`).
- `src/app/app/page.tsx` – Hjem. `…/lister`, `…/familie`, `…/kalender`, `…/gjoremal` – egne sider.
- `src/components/HouseholdContext.tsx` – `useHousehold()`-hook (aktiv husholdning + medlemmer).
- `src/components/BottomNav.tsx` – ruting med `next/link`.
- `src/components/ShoppingList.tsx` – sanntidsliste med optimistisk UI.
- `src/lib/supabase/*` – typede klienter (nettleser/server/middleware).

### Databasefunksjoner (kalles via `supabase.rpc`)
`create_invite(p_ttl_hours)`, `join_household(p_code)`, `set_active_household(p_hid)`,
`add_child(p_name, p_color)`, `leave_household(p_hid)`, `create_household(p_name)`.

## Neste steg
1. Kalender: `events` + `event_members` (egen `…/kalender`-side, samme mønster).
2. Gjøremål: `todos` med ansvarlig, frist, prioritet.
3. Varsling: `notifications` + push.
4. Måltider og ukepenger.
5. **Ekte offline-skriving:** PWA cacher app-skallet, men offline *endringer* som synker
   senere krever en skrivekø (outbox) eller en synk-motor (f.eks. PowerSync/ElectricSQL).

## AI-veileder (valgfritt)
Kosthold/trening-siden i `/app/helse` kan vise en AI-drevet veileder (chat,
ukesprogram, ukesgjennomgang, måltidsforslag) via Anthropic sin API
(`claude-haiku-4-5`). Dette er den eneste betalte tjenesten i appen.

- Sett `ANTHROPIC_API_KEY` i Vercel (server-side only — **aldri** `NEXT_PUBLIC_`),
  og husk å redeploye etter at den er satt.
- Mangler nøkkelen, skjules hele Veileder-seksjonen stille — resten av appen
  fungerer 100 % uten.
- **Sett en Spend Limit på $5/mnd i Anthropic Console** før du slår den på i
  produksjon — appen håndhever egne per-medlem/per-husholdning-grenser
  (25 kall/dag, 600 kall/mnd), men en Spend Limit er et nyttig ekstra
  sikkerhetsnett mot uforutsette kostnader.

## Notater
- `@supabase/ssr` må være en nyere versjon (0.10+) for at databasetypene skal flyte
  korrekt sammen med supabase-js 2.10x.
- Du kan bruke **Claude Code** til å bygge videre og vedlikeholde prosjektet.
