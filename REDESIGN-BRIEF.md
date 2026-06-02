# REDESIGN-BRIEF — Heim → «Reint & moderne» (iOS/Linear)

> **Til Claude Code:** Dette er en komplett arbeidsordre. Gjennomfør hele redesignet
> av Heim-grensesnittet etter spesifikasjonen under. **Endre kun UI** – ikke rør
> Supabase-kall, RLS, sanntid eller ruting. Visuell fasit: `heim-redesign-mockup.html`
> (legg den i repo-roten). Jobb skjerm for skjerm, vis resultat og vent på
> godkjenning etter Hjem-skjermen. Commit etter hver fungerende skjerm.
>
> **Slik starter brukeren:** legg denne filen + `heim-redesign-mockup.html` i
> repo-roten og si: «Les REDESIGN-BRIEF.md og gjennomfør hele redesignet.»

---

## 0. Oppsett (gjør først)
```bash
claude mcp add shadcn -- npx shadcn@latest mcp     # live komponent-register
npx shadcn@latest init                              # base: neutral, radius 0.9rem
npm i lucide-react
```
- Legg til **Geist** via `next/font` (`next/font/google` → `Geist`), sett som standard
  font i `layout.tsx`. Fjern all serif-bruk.
- Bytt ut **alle emoji-ikoner** med `lucide-react`.

## 1. Designtokens (sett i `src/app/globals.css`, bruk overalt – aldri hardkod farger)
```css
:root {
  --background:#f5f6f8;  --surface:#ffffff;     --surface-2:#eef0f4;
  --foreground:#14161c;  --text-2:#5b626d;      --text-3:#99a0ac;
  --border:#e8eaef;      --accent:#12936b;      --accent-weak:#e7f4ee;
  --radius:18px;
}
```
Map til shadcn-variabler ved `init`: `--background`, `--foreground`, `--card=#fff`,
`--primary=#12936b`, `--primary-foreground=#fff`, `--muted=#eef0f4`,
`--muted-foreground=#5b626d`, `--border=#e8eaef`, `--ring=#12936b`, `--radius:0.9rem`.

**Medlemsfarger – kun som små prikker/avatarer:** teal `#0d9488`, rav `#f59e0b`,
lilla `#7c5cff`, korall `#f97316`.

**Stilregler (det som gir «Linear-roen»):**
- Hårfine `1px` borders + **lett** skygge: `0 1px 2px rgba(20,22,28,.04), 0 2px 8px rgba(20,22,28,.05)`.
- Aksenten brukes **sparsomt**: lenker, aktiv nav, avkryssing, primær-CTA.
- Kjølig lysegrå bakgrunn, hvite kort, god luft (18px sidemarg). Mobil-først,
  sentrert maks-bredde ~420px.
- Typeskala: tittel 27/700 `-0.03em` · seksjonsetikett 12/600 UPPERCASE `0.07em` (text-3)
  · brødtekst 15/550 · sekundær 12.5–13 (text-2/3).
- Valgfri innlastings-animasjon: rolig stagger fade-up; respekter `prefers-reduced-motion`.

## 2. Gjenbrukbare komponenter (bygg disse først, match mockupen)
| Komponent | Spesifikasjon |
|---|---|
| `Avatar` | Sirkel, medlemsfarge bg, hvit initial. Størrelser 22/28/34. |
| `Chip` | Pille (medlemsfilter): surface+border; aktiv = `--foreground` bg + hvit tekst; leading `Avatar` 22px. |
| `SectionLabel` | Rad: `h2` uppercase 12/600 text-3 + valgfri høyre-lenke (accent 13/600 + `ArrowRight` 14). |
| `Card` | surface, 1px border, radius 18, lett skygge. |
| `TodoRow` | Avkryssing 22px (radius 7, 2px border `#d6dae1`; fullført = accent-bg + hvit `Check`). Venstre 3px fargebar (prioritet/medlem). Tittel 15/550 + sub: liten prikk + «ansvarlig · frist» (text-3). |
| `EventRow` | Datotile 46px (surface-2, radius 13: tall 17/700 over ukedag 10/600 uppercase text-3) + tittel 15/600 + sub 12.5 (text-2) + trailing medlemsprikk. 1px skille mellom rader. |
| `ShortcutTile` | Kort radius 16: ikon i 38px tintet, avrundet felt + label 12.5/550. Grid 3 kolonner, gap 10. |
| `BottomNav` | Fixed, blur-bakgrunn, 1px topp-border. 5 faner: Home, ShoppingCart, SquareCheck (el. CheckSquare), Calendar, Users. Label 10.5/600. Aktiv = accent. |
| `NotificationRow` | accent-weak ikonfelt (`Bell`) + tittel/sub + `ChevronRight`. |
| `Header` | Kicker (text-3 12.5/600) + navn (27/700) + dato (13 text-2). Høyre: to ikon-knapper 38px (`Bell` m/korall badge-prikk, `LogOut`). |

**Lucide-mapping:** Bell, Calendar, ShoppingCart, SquareCheck/CheckSquare, Utensils,
Wallet, Users, Home, ChevronRight, ArrowRight, LogOut, Plus.

## 3. Skjerm-for-skjerm

**A. Hjem (først – stopp og vis resultat):**
Bygg om så den matcher `heim-redesign-mockup.html`: Header → medlemsfilter (Chips) →
«I dag» (tom-tilstand med ikon) → «Gjøremål» (`TodoRow`) → «Resten av uken»
(`EventRow` m/datotiler) → «Snarveier» (3×2 `ShortcutTile`) → `NotificationRow` →
`BottomNav`. **Vent på godkjenning før du går videre.**

**B. Lister:** liste-velger som piller/segmented; varer som rene rader (check + tekst +
ansvarlig-prikk + slett); «legg til» som rent felt + accent-knapp; pen tom-tilstand.

**C. Gjøremål:** `TodoRow`-liste filtrert via medlems-`Chip`s; «ny» via shadcn
`Dialog`/`Sheet`; prioritet som venstre fargebar.

**D. Kalender:** segmented (shadcn `Tabs`) Agenda / 3-dager / Måned; Agenda bruker
dag-overskrifter + `EventRow`.

**E. Familie:** medlemsliste med `Avatar`; invitasjons-kort (accent) + bli-med-felt;
bytt/forlat som rolige rader. Samme kort-/token-stil.

*(Tavle/entré tas i en egen runde – ikke del av dette passet.)*

## 4. Akseptansekriterier (per skjerm)
- Matcher uttrykket i mockupen; **ingen emoji** (kun lucide).
- Bruker tokenene/komponentene over – ingen hardkodede farger.
- Mobil-først, sentrert maks-bredde; hårfine borders + lett skygge; aksent sparsomt.
- `npx tsc --noEmit` og `npm run build` er grønne.
- **Ingen endring i datalogikk** (Supabase, RLS, sanntid, ruting uendret).
- Commit per ferdig skjerm med beskrivende melding.

## 5. Guardrails
- Spør før destruktive kommandoer.
- Behold optimistisk UI og sanntids-mønsteret i listene.
- Norsk i grensesnittet.
- Hvis noe i mockupen og funksjonaliteten kolliderer: behold funksjonaliteten, match
  uttrykket så godt som mulig, og si fra.
