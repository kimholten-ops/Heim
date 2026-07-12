// Artikkelinnhold for /artikler. Skrevet selvstendig — ingen kopiering fra
// konkurrentenes sider. Faktapåstander om konkurrenter er tidsstemplet
// ("per juli 2026") siden priser og funksjoner endrer seg.

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "cta" };

export type Article = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO
  body: ArticleBlock[];
};

export const articles: Article[] = [
  {
    slug: "beste-familiekalender-app-2026",
    title: "Beste familiekalender-app i 2026 — norsk guide",
    description:
      "Vi sammenligner Cozi, FamilyWall, TimeTree, FamiliePluss, MinFamiliePlan, Google Kalender og Heim — nøkternt om styrker og svakheter hos alle sammen.",
    date: "2026-07-01",
    body: [
      { type: "p", text: "Å finne riktig familiekalender-app handler mindre om hvilken som har flest funksjoner, og mer om hvilken familien din faktisk kommer til å bruke. Her går vi gjennom de mest brukte alternativene for norske familier per juli 2026 — inkludert Heim, som vi selv har bygget, så ta den delen med en klype salt og les videre for de andre." },

      { type: "h2", text: "Cozi" },
      { type: "p", text: "Cozi er trolig den mest kjente familiekalenderen internasjonalt, og har vært det i over 15 år. Den er stabil, enkel å komme i gang med, og har en delt handleliste og gjøremålsliste i tillegg til kalenderen. Ulempen kom i mai 2024, da Cozi innførte en betalingsmur i gratisversjonen: du ser nå kun de neste 30 dagene i kalenderen din med mindre du betaler for Cozi Gold, som koster rundt $39 i året. Det låser også opp månedsvisning, flere påminnelser og bursdagsvarsler. For en familie som vil planlegge sommerferien i januar, er 30-dagers-grensen en reell begrensning." },

      { type: "h2", text: "FamilyWall" },
      { type: "p", text: "FamilyWall har en bred funksjonspakke — kalender, handlelister, gjøremål og privat chat i gratisversjonen. Men gratisversjonen har kun 100 MB lagringsplass, og de fleste familier ender opp med å oppgradere til Premium (ca. $4,99/mnd eller $44,99/år per juli 2026) for å få måltidsplanlegging, posisjonsdeling, økonomi-sporing og synk mot Google/Outlook-kalender. Det er et solid produkt, men det er bygget for at gratisversjonen skal føles trang." },

      { type: "h2", text: "TimeTree" },
      { type: "p", text: "TimeTree skiller seg ut ved at gratisversjonen faktisk er ganske raus: ubegrensede delte kalendere, kommentarer på hendelser, notater og gjøremålslister, og synk med Google-, Apple- og Outlook-kalender. Ulempen er reklame i appen. TimeTree Premium (ca. $4,49/mnd) fjerner annonsene og legger til filvedlegg på hendelser. Hvis reklame ikke plager deg, er TimeTree et av de mer gavmilde alternativene på markedet." },

      { type: "h2", text: "FamiliePluss" },
      { type: "p", text: "FamiliePluss er en norsk familieapp med kalender, smart handleliste, måltidsplanlegger og familiebudsjett, og markedsfører seg som gratis. Den har blant annet AI som kategoriserer handlelisteartikler automatisk og foreslår middager basert på sesong og norske matvaner. Vi har ikke gått grundig gjennom hvor grensen mellom gratis og eventuelle betalte tillegg går i praksis, så sjekk det selv før du legger inn hele familiens data." },

      { type: "h2", text: "MinFamiliePlan" },
      { type: "p", text: "MinFamiliePlan er en annen norsk aktør, med delt kalender, bursdagspåminnelser, ønskelister og handleliste i sanntid. Den koster 49 kr i måneden — for hele familien, ikke per person — med 30 dagers gratis prøveperiode og betaling via Vipps. Den er tydelig bygget for og av nordmenn, med norske helligdager inkludert og norsk kundeservice." },

      { type: "h2", text: "Google Kalender" },
      { type: "p", text: "Google Kalender er gratis, allerede installert for de fleste, og fungerer fint til å dele én kalender med familien. Det den mangler er alt det andre en familie trenger — handlelister, gjøremålsfordeling, måltidsplan — så mange familier ender opp med Google Kalender pluss en Notat-app pluss en SMS-tråd for handlelisten. Det er gratis, men det er ikke ett sted." },

      { type: "h2", text: "Heim" },
      { type: "p", text: "Heim er vår egen app: delt kalender, handlelister og gjøremål i sanntid, på norsk, helt gratis uten betalingsmur eller annonser. Vi bygger den fordi vi selv er en familie som ville ha noe som Cozi var før 2024 — men uten at noen plutselig sperrer kalenderen din bak et abonnement. Vi er nyest på markedet av de nevnt her, så vi har færre år med drift bak oss enn Cozi eller TimeTree. Det er en reell avveining du bør vekte inn." },

      { type: "cta" },

      { type: "h2", text: "Så hvilken skal du velge?" },
      { type: "p", text: "Hvis familien din allerede bruker Cozi og ikke er plaget av 30-dagers-grensen, er det ingen god grunn til å bytte. Hvis dere vil ha mye funksjonalitet og ikke bryr dere om å betale, er FamilyWall solid. Hvis gratis-med-reklame er greit, er TimeTree et godt valg. Hvis dere vil ha noe norsk med lav pris, er MinFamiliePlan verdt å se på. Og hvis dere vil ha noe gratis, norsk og moderne uten betalingsmur — er det derfor vi bygget Heim." },
    ],
  },

  {
    slug: "cozi-pa-norsk-alternativer",
    title: "Cozi på norsk? Alternativer for norske familier",
    description:
      "Cozi finnes ikke på norsk, og gratisversjonen ble strammet inn i 2024. Her er hva norske familier faktisk bruker i stedet.",
    date: "2026-07-02",
    body: [
      { type: "p", text: "«Finnes det en norsk Cozi?» er et spørsmål vi ser stadig oftere. Svaret er todelt: nei, Cozi finnes ikke på norsk — grensesnittet er engelsk (og noen andre store språk, men ikke norsk) — og for mange er ikke det lenger det eneste problemet med appen." },

      { type: "h2", text: "Hvorfor folk leter etter alternativer" },
      { type: "p", text: "Cozi var i mange år standardvalget for familiekalendere internasjonalt, og mange norske familier brukte den til tross for at den ikke var oversatt. Det endret seg litt i mai 2024, da Cozi innførte en 30-dagers-grense på gratisversjonen: du kan ikke lenger se eller legge inn hendelser mer enn 30 dager fram i tid uten å betale for Cozi Gold (ca. $39/år per juli 2026). For en familie som planlegger jul i august, eller sommerferie i januar, er det en reell begrensning — ikke bare en «oppgrader for ekstra funksjoner»-nudge." },

      { type: "h2", text: "Språket er fortsatt et problem" },
      { type: "p", text: "Selv om prisen ikke plager deg, er Cozi fortsatt en engelskspråklig app. For familier med barn som ikke leser engelsk flytende ennå, eller besteforeldre som skal følge med på kalenderen, er det en reell friksjon å navigere en app på et annet språk hver dag." },

      { type: "h2", text: "Hva norske familier bruker i stedet" },
      { type: "ul", items: [
        "MinFamiliePlan — norsk app, 49 kr/mnd for hele familien, norske helligdager og norsk kundeservice.",
        "FamiliePluss — norsk app med kalender, handleliste og måltidsplanlegger, markedsført som gratis.",
        "Google Kalender — gratis og på norsk, men dekker kun kalenderdelen, ikke handlelister eller gjøremål.",
        "Heim — vår egen app: norsk, gratis uten betalingsmur, sanntids-synk for kalender, handlelister og gjøremål.",
      ]},

      { type: "cta" },

      { type: "h2", text: "Hva bør du se etter?" },
      { type: "p", text: "Uansett hvilken app du velger, sjekk disse fire tingene før du legger inn hele familiens liv i den:" },
      { type: "ul", items: [
        "Er grensesnittet faktisk oversatt til norsk, eller bare delvis?",
        "Er det en reell gratisversjon, eller en «gratis prøveperiode» som går over til betaling?",
        "Synkroniserer den i sanntid, eller må dere trykke «oppdater» for å se endringer fra hverandre?",
        "Hvor lagres dataene — er det GDPR-kompatibelt, og hvor i verden ligger serverne?",
      ]},
      { type: "p", text: "Vi har bygget Heim nettopp fordi vi selv lette etter en app som svarte «ja» på alle fire, uten et abonnement i veien. Det betyr ikke at den er perfekt for alle — men det er derfor den finnes." },
    ],
  },

  {
    slug: "delt-handleliste-app-sanntid",
    title: "Delt handleliste-app: 5 alternativer som synker i sanntid",
    description:
      "«Hvem skulle kjøpe melk?» Vi sammenligner fem apper for delt handleliste som faktisk oppdaterer seg i sanntid mellom familiemedlemmer.",
    date: "2026-07-03",
    body: [
      { type: "p", text: "Den klassiske familiefrustrasjonen: to personer drar til butikken samme kveld, ingen av dem visste at den andre allerede hadde handlet melk. En delt handleliste løser det — men bare hvis den faktisk oppdaterer seg med det samme, ikke bare når noen åpner appen på nytt. Her er fem alternativer som gjør det, og hva som skiller dem." },

      { type: "h2", text: "1. TimeTree" },
      { type: "p", text: "TimeTree er primært en kalender-app, men har notater og delte lister som fungerer greit til handling. Gratisversjonen er raus, med reklame som eneste ulempe. Ikke en dedikert handleliste-app, men fungerer som et gratis tillegg hvis dere allerede bruker TimeTree til kalenderen." },

      { type: "h2", text: "2. FamilyWall" },
      { type: "p", text: "FamilyWall har en delt handleliste i gratisversjonen, sammen med kalender og gjøremål. Sanntids-oppdatering fungerer bra, men den 100 MB store lagringsgrensen i gratisversjonen gjelder appen som helhet, ikke bare handlelisten, så det er sjelden det som begrenser deg her." },

      { type: "h2", text: "3. Cozi" },
      { type: "p", text: "Cozi har hatt delt handleliste siden starten, og den er fortsatt i gratisversjonen selv etter innstramningen i 2024 — det er kalenderen som ble begrenset til 30 dager, ikke listene. Hvis du kun trenger handlelisten og ikke bryr deg om kalenderdelen, kan gratisversjonen faktisk holde." },

      { type: "h2", text: "4. MinFamiliePlan" },
      { type: "p", text: "MinFamiliePlan har delt handleliste som del av 49 kr/mnd-pakken, sammen med kalender og ønskelister. Sanntids-oppdatering er en av kjernefunksjonene de fremhever selv. Norsk, med norsk kundeservice." },

      { type: "h2", text: "5. Heim" },
      { type: "p", text: "Heim har delt handleliste med ekte sanntids-synk — når noen krysser av melk på butikken, ser resten av familien det med det samme, ikke etter en manuell oppdatering. Gratis, norsk, ingen betalingsmur. Vi bygde den fordi vi selv var lei av SMS-tråder om hvem som skulle kjøpe hva." },

      { type: "cta" },

      { type: "h2", text: "Hva betyr «sanntid» egentlig?" },
      { type: "p", text: "Ikke alle apper som sier «delt liste» faktisk synker i sanntid. Noen krever at du drar ned for å oppdatere, eller synker først når appen åpnes på nytt. Test det selv: be en i familien krysse av noe på listen mens du ser på skjermen din i en annen app — dukker det opp uten at du gjør noe? Hvis ikke, er det ikke reell sanntid, bare periodisk synk." },
    ],
  },

  {
    slug: "felles-familiekalender-uten-a-betale",
    title: "Slik får familien én felles kalender (uten å betale)",
    description:
      "En praktisk guide til å samle familiens avtaler på ett sted — uten abonnement, uten betalingsmur.",
    date: "2026-07-04",
    body: [
      { type: "p", text: "De fleste familier har allerede en form for kalender-kaos: fotballtrening i én app, tannlegetime i en SMS, foreldremøte på en lapp på kjøleskapet. Å samle alt på ett sted er enklere enn det høres ut — og det trenger ikke å koste noe." },

      { type: "h2", text: "Steg 1: Velg ett sted — og bare ett" },
      { type: "p", text: "Det viktigste steget er ikke hvilken app du velger, men at hele familien faktisk bruker den samme. En kalender som bare halve familien sjekker er verdiløs. Sett av fem minutter til å bli enige: dette er stedet avtaler skal inn, ikke SMS, ikke en lapp, ikke «jeg sa det jo til deg i går»." },

      { type: "h2", text: "Steg 2: Se etter en gratis løsning uten skjulte begrensninger" },
      { type: "p", text: "Mange familiekalendere reklamerer med «gratis», men har begrensninger som først merkes etter noen måneder — Cozi sin gratisversjon viser for eksempel kun 30 dager fram i tid siden 2024. Google Kalender er reelt gratis og ubegrenset, men mangler handlelister og gjøremålsfordeling. Se etter apper som er gratis for alt dere faktisk trenger, ikke bare for kalenderdelen." },

      { type: "h2", text: "Steg 3: Fordel farger, ikke bare navn" },
      { type: "p", text: "Gi hvert familiemedlem en egen farge i kalenderen. Det gjør det mulig å se «er dette min, eller er det ungenes fotballtrening?» med et blikk, uten å måtte lese hver hendelse i detalj. De fleste familiekalender-apper støtter dette, inkludert Heim." },

      { type: "cta" },

      { type: "h2", text: "Steg 4: Bruk gjentakelse for faste avtaler" },
      { type: "p", text: "Fotballtrening hver tirsdag, pianoTime hver onsdag — legg dem inn én gang som gjentakende hendelser i stedet for å taste dem inn på nytt hver uke. Det er den enkeltendringen som sparer mest tid over et helt semester." },

      { type: "h2", text: "Steg 5: Koble kalenderen til telefonens egen kalender-app" },
      { type: "p", text: "Mange familiekalendere (Heim inkludert) lar deg abonnere på familiens kalender fra iPhones innebygde Kalender-app via en abonnementslenke. Da dukker avtalene opp sammen med resten av livet ditt, uten å måtte åpne en egen app for å sjekke om noe skjer i dag. Merk: dette er vanligvis én vei (endringer i familie-appen dukker opp på telefonen, ikke omvendt) og med litt forsinkelse — les hva appen din faktisk lover før du stoler blindt på det." },

      { type: "p", text: "Ingen av disse fem stegene krever et abonnement. Det krever bare at dere faktisk bruker det dere setter opp — og det er den delen ingen app kan gjøre for dere." },
    ],
  },

  {
    slug: "ukeplan-fra-skolen-inn-i-kalenderen",
    title: "Ukeplan fra skolen rett inn i kalenderen — slik gjør du det",
    description:
      "SFO-ukeplaner og skoleskriv havner sjelden i familiekalenderen av seg selv. Her er en praktisk fremgangsmåte som faktisk fungerer over tid.",
    date: "2026-07-05",
    body: [
      { type: "p", text: "Skoleskriv og SFO-ukeplaner er blant de mest kalender-relevante papirene som kommer inn i et familieliv — og de mest sannsynlige å bli glemt i sekken. Her er en fremgangsmåte som faktisk holder over et helt semester, ikke bare de to første ukene." },

      { type: "h2", text: "Hvorfor det ikke skjer av seg selv" },
      { type: "p", text: "Problemet er sjelden vilje — det er friksjon. Å taste inn «svømming hver torsdag kl. 12–13» tar femten sekunder, men de femten sekundene skjer aldri fordi skrivet ligger i sekken til fredag, og da er ukeplanen for uken allerede over." },

      { type: "h2", text: "Steg 1: Legg inn faste ting som gjentakende hendelser" },
      { type: "p", text: "Det meste av en ukeplan er fast gjennom hele semesteret: gym på mandager, svømming annenhver torsdag, SFO til 16 på onsdager. Legg disse inn én gang, som gjentakende hendelser («hver uke» eller «annenhver uke»), i stedet for å taste dem på nytt hver mandag. I Heim gjør du dette i «Ny hendelse»-skjemaet — velg gjentakelse, så slipper du å tenke på det igjen før semesteret er over." },

      { type: "h2", text: "Steg 2: Ta et bilde av skrivet med det samme" },
      { type: "p", text: "Når skrivet kommer hjem, ta et bilde av det med telefonen der og da — i gangen, før sekken havner i et hjørne. Bildet er i seg selv en påminnelse: legg det i et album eller en mappe kalt «Skole», så har du referansen tilgjengelig neste gang du skal legge inn noe fra det." },

      { type: "cta" },

      { type: "h2", text: "Steg 3: Sett av to minutter hver søndag" },
      { type: "p", text: "I stedet for å prøve å reagere på hvert skriv idet det kommer, sett av to faste minutter hver søndag kveld til å sjekke: er det noe nytt denne uken (utflukt, endret sluttid, fridag)? Legg det inn som en engangs-hendelse for den uken, oppå de faste gjentakende hendelsene du allerede har lagt inn." },

      { type: "h2", text: "Steg 4: Del kalenderen med alle som trenger den" },
      { type: "p", text: "Skole- og SFO-avtaler er ofte relevante for flere enn foreldrene — besteforeldre som henter, en nabo som kjører til trening. Sørg for at kalenderen faktisk er delt med alle som trenger å se den, og at de vet at det er dit de skal se, ikke i en SMS-tråd." },

      { type: "h2", text: "Om automatisk gjenkjenning av ukeplaner" },
      { type: "p", text: "Flere familie-apper (inkludert enkelte av konkurrentene til Heim) har begynt å eksperimentere med AI som leser bilder av ukeplaner og foreslår hendelser automatisk. Vi jobber med noe tilsvarende i Heim, men det er ikke lansert ennå — akkurat nå er manuell innlegging, som beskrevet over, den mest pålitelige måten å få skoleskrivet inn i kalenderen på. Vi oppdaterer denne artikkelen når det endrer seg." },
    ],
  },

  {
    slug: "familieplanlegging-for-travle-smabarnsforeldre",
    title: "Familieplanlegging for travle småbarnsforeldre: et enkelt system",
    description:
      "Du trenger ikke et komplisert system for å holde styr på familielivet — du trenger ett sted, tre vaner, og fem minutter om dagen.",
    date: "2026-07-06",
    body: [
      { type: "p", text: "Med små barn i huset er tiden man har til overs for «system» og «organisering» omtrent null. Det gode er at det ikke trengs mye. Her er et minimalt oppsett som faktisk holder, bygget rundt tre vaner i stedet for ett stort system." },

      { type: "h2", text: "Vane 1: Ett sted for alt, ikke fire" },
      { type: "p", text: "Det vanligste feilgrepet er å spre familielivet over flere verktøy — kalenderen i telefonen, handlelisten i en notat-app, gjøremål i hodet til den ene forelderen. Med ett sted som dekker kalender, handleliste og gjøremål, slipper man å huske hvor man la ting sist. Det er hele poenget med apper som Cozi, FamilyWall, MinFamiliePlan eller vår egen Heim — men velg én, og bruk bare den." },

      { type: "h2", text: "Vane 2: Fem minutter søndag kveld" },
      { type: "p", text: "Ikke prøv å planlegge hele uken i én lang økt. Sett av fem minutter søndag kveld til å se gjennom uken som kommer: hva er nytt, hva mangler i handlelisten, hvem henter i barnehagen på onsdag. Fem minutter er lite nok til at det faktisk skjer hver uke." },

      { type: "h2", text: "Vane 3: Legg inn med det samme, ikke «senere»" },
      { type: "p", text: "Når en avtale dukker opp — legen ringer, barnehagen sender en beskjed — legg den inn i kalenderen der og da, ikke «jeg husker det». Med to travle voksne er «jeg husker det» den vanligste årsaken til dobbeltbookinger og glemte avtaler." },

      { type: "cta" },

      { type: "h2", text: "Fordel ansvar, ikke bare informasjon" },
      { type: "p", text: "En delt kalender løser «hvor er avtalen», men ikke «hvem gjør hva». Bruk en gjøremålsliste med tydelig ansvarlig per oppgave — ikke bare en lang liste alle ser på og håper noen andre tar. Når «kjøp bleier» har navnet ditt på seg, blir det gjort. Når det bare står på en felles liste, blir det ofte ikke det." },

      { type: "h2", text: "Barn kan være med, selv de minste" },
      { type: "p", text: "Selv små barn kan ha en enkel gjøremålsliste — rydde leker, mate katten — synlig i den samme appen resten av familien bruker. Det gir dem eierskap til egne oppgaver, og det tar dem inn i systemet i stedet for å holde dem utenfor det." },

      { type: "h2", text: "Det viktigste rådet" },
      { type: "p", text: "Ikke la det gode systemet bli fienden av det gjennomførbare. Et enkelt oppsett dere faktisk bruker hver uke slår et avansert system dere gir opp etter tre uker. Start minimalt — ett sted, tre vaner — og bygg på når det trengs, ikke før." },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}
