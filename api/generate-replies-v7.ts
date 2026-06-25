import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface TopicA {
  situation: string  // Freie Beschreibung der A-Situation (1-2 Saetze von Haiku)
  barOption: boolean // true wenn Bar/Stehtisch als naechster Schritt sinnvoll ist
}

interface Analysis {
  count: number
  points: string[]
  nominative: string[]  // Hauptproblem pro Issue im Nominativ ohne Artikel (z.B. "rohes Hähnchen")
  categories: string[]
  forceSummarize: boolean
  lobpunkte: string[]
  vorOrtErwaehnt: boolean
  isServiceComplaint: boolean
  ambiguousB: boolean
  topicA?: TopicA
}

// ─── KATEGORIE-KOMBINATIONEN ──────────────────────────────────────────────────

type CategoryCombo =
  | 'A_ONLY'
  | 'B_ONLY'
  | 'C_ONLY'
  | 'AB'
  | 'AC'
  | 'BC'
  | 'ABC'
  | 'B_SERVICE'

function resolveCombo(analysis: Analysis): CategoryCombo {
  const cats = [...new Set(analysis.categories)]
  if (cats.includes('B') && analysis.isServiceComplaint && !cats.includes('A')) return 'B_SERVICE'
  const sorted = cats.sort().join('')
  const map: Record<string, CategoryCombo> = {
    'A': 'A_ONLY', 'B': 'B_ONLY', 'C': 'C_ONLY',
    'AB': 'AB', 'AC': 'AC', 'BC': 'BC', 'ABC': 'ABC',
  }
  return map[sorted] || 'B_ONLY'
}

// ─── CLASSIFY ─────────────────────────────────────────────────────────────────

function classify(rating: number, reviewText: string): string {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  const hasText = wordCount >= 6
  if (!hasText && rating >= 4) return 'EMPTY_POSITIVE'
  if (!hasText && rating <= 2) return 'EMPTY_NEGATIVE'
  if (rating >= 4) return 'CONTENT_POSITIVE'
  if (rating === 3) return 'CONTENT_MIXED'
  return 'CONTENT_NEGATIVE'
}

// ─── SHARED: SETTINGS AUFLÖSEN ───────────────────────────────────────────────

function resolveSettings(settings: any, reviewerName: string) {
  const {
    businessName = 'das Restaurant',
    salutation = 'Sie',
    contactEmail = '',
    responseSignature = '',
    responseLanguage = 'Deutsch',
    description = '',
    restaurantType = '',
    cuisineType = '',
    restaurantAtmosphere = '',
    uniqueSellingPoints = '',
    priceRange = '',
  } = settings || {}

  const duSie = salutation === 'Du'
    ? 'Du/Dein (Duzen). Schreibe "du", "dir", "dein", "dich" klein.'
    : 'Sie/Ihr (Siezen)'
  const signature = responseSignature || `Das Team von ${businessName}`
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const firstNameClean = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''
  const langInstruction =
    responseLanguage === 'Sprache des Bewerters' ? 'Antworte in der Sprache der Bewertung.' :
    responseLanguage === 'Englisch' ? 'Respond in English only.' :
    'Antworte auf Deutsch.'
  const context = [
    `Restaurant: ${businessName}`,
    description          && `Beschreibung: ${description}`,
    restaurantType       && `Typ: ${restaurantType}`,
    cuisineType          && `Kueche: ${cuisineType}`,
    priceRange           && `Preisklasse: ${priceRange}`,
    restaurantAtmosphere && `Atmosphaere: ${restaurantAtmosphere}`,
    uniqueSellingPoints  && `Besonderheiten: ${uniqueSellingPoints}`,
  ].filter(Boolean).join('\n')

  return { businessName, salutation, contactEmail, signature, duSie, isDu: salutation === 'Du', firstNameClean, langInstruction, context }
}

// ─── SHARED: FORMAT-REGELN (gelten immer) ────────────────────────────────────
// Dieser Block erscheint in JEDEM Prompt — er ist kurz und eindeutig.

const FORMAT_RULES = `ABSOLUTES VERBOT — GEDANKENSTRICHE: Verwende niemals "–", "—" oder langen Bindestrich. Ersetze durch Punkt oder Komma.
ABSOLUTES VERBOT — TAGESZEITEN: Niemals "Abend", "Morgen", "Mittag", "Nacht", "Fruehstueck". Stattdessen "Besuch", "Aufenthalt", "Zeit bei uns".
ABSOLUTES VERBOT — DOPPELPUNKT-LABEL: Kein "Zur Tischzeit:" oder aehnliche Ueberschriften. Durchgehende Saetze.
VERBOTENE WOERTER: "frustrierend", "intern adressiert", "intern nachgeschaerft", "massnahmen ergriffen", "entspricht nicht unserem anspruch", "nehmen wir sehr ernst", "gib uns eine chance".
UMLAUTE: Nutze ä, ö, ü, ß — niemals ae, oe, ue.
RESTAURANTPROFIL: Nutze Angaben aus dem Restaurantprofil nur sinngemaess — niemals woertlich zitieren oder als Adjektiv-Kette einfuegen. Leite nichts aus dem Restaurantnamen ab.
GRAMMATIK: Jeder Satz muss vollstaendig sein (Subjekt, Praedikat). Maximal zwei Kommas pro Satz — sonst aufteilen.`


// ─── DU/SIE HELPER ────────────────────────────────────────────────────────────
// Wählt den richtigen Text je nach Anredeform
function d(isDu: boolean, duText: string, sieText: string): string {
  return isDu ? duText : sieText
}


// Platzhalter [KERN] wird per .replace() mit dem nominativ-Wert aus analyzeReview() gefüllt.

const KERN_B: string[] = [
  "Es gibt Standards, die am Gast ausnahmslos sitzen müssen, und [KERN] darf in unserem Betrieb nicht vorkommen.",
  "Unser Anspruch an die Küche und den Ablauf ist hoch, aber [KERN] bricht diese Vorgabe komplett.",
  "Ein reibungsloser Ablauf sieht anders aus, und [KERN] zeigt deutlich, wo die Übergabe bei diesem Besuch versagt hat.",
]

const KERN_B_SERVICE: string[] = [
  "So soll sich kein Gast bei uns fühlen, und [KERN] ist kein Standard den wir akzeptieren.",
  "Dass [KERN] so in Erinnerung bleibt, ist nicht das, was wir uns für einen Besuch vorstellen.",
  "Bei [KERN] sind wir klar hinter dem zurückgeblieben, was ein Gast von uns erwarten darf.",
]

// ─── KERN_C: feste Sätze ohne Platzhalter ────────────────────────────────────
const KERN_C_GESCHMACK = "Wir kochen nach unseren eigenen, festen Rezepturen, treffen damit aber naturgemäß nicht immer jeden Nerv."
const KERN_C_MENGE     = "Unsere Gerichte sind so kalkuliert, dass sie für den durchschnittlichen Hunger eine runde Mahlzeit bieten."
const KERN_C_PREIS     = "Wir stecken viel Liebe und nur die besten Zutaten in unsere Gerichte, und das hat am Ende eben auch seinen fairen Preis."
const KERN_C_PREIS_LEISTUNG = "Wir achten bei all unseren Gerichten auf die Qualität und Frische der Zutaten, um ein faires Verhältnis zwischen Preis und Leistung zu bieten."
const KERN_C_AUSWAHL   = "Wir kalkulieren unsere frischen Zutaten täglich genau, um Verschwendung zu vermeiden, wodurch beliebte Gerichte im Laufe des Tages auch mal vergriffen sein können."
const KERN_C_VAGE      = "War's die Zubereitung, beim nächsten Mal bitte direkt ansprechen, dann regeln wir das sofort. War's einfach nicht dein Geschmack, kein Problem, wir empfehlen dir gerne was Passenderes."

// Erkennt C-Unterkategorie anhand des Nominativs
function resolveKernC(nominativ: string): string {
  const n = nominativ.toLowerCase()
  if (n.includes('vage') || n.includes('geschmack allgemein') || n.includes('kein grund')) return KERN_C_VAGE
  if (n.includes('portion') || n.includes('menge') || n.includes('klein') || n.includes('wenig')) return KERN_C_MENGE
  if (n.includes('preis') && (n.includes('leistung') || n.includes('verhältnis'))) return KERN_C_PREIS_LEISTUNG
  if (n.includes('preis') || n.includes('teuer') || n.includes('kosten')) return KERN_C_PREIS
  if (n.includes('auswahl') || n.includes('vergriffen') || n.includes('ausverkauft') || n.includes('karte')) return KERN_C_AUSWAHL
  return KERN_C_GESCHMACK // Default: Geschmack/Würze/Zubereitung
}

const KERN_A: string[] = [
  "Wir haben uns bewusst für diesen Weg entschieden, und [KERN] ist fester Bestandteil unseres Betriebsmodells.",
  "Unser Restaurant baut auf einer klaren Struktur auf, und [KERN] ist hierbei bewusst so gewählt und wird nicht spontan geändert.",
  "Hinter unserem Service-Ablauf steht ein klares System; [KERN] gehört zu den Grundregeln unseres Hauses.",
]

const KERN_POSITIV: string[] = [
  "Das hören wir gern, genau so soll's laufen. Bis zum nächsten Mal.",
  "Danke, das freut uns wirklich. Komm gerne wieder vorbei.",
  "Schön, dass alles gepasst hat. Wir sehen uns.",
]
const KERN_POSITIV_SIE: string[] = [
  "Das hören wir gern, genau so soll's laufen. Bis zum nächsten Mal.",
  "Danke, das freut uns wirklich. Kommen Sie gerne wieder vorbei.",
  "Schön, dass alles gepasst hat. Wir sehen uns.",
]

function buildPositivePrompt(
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any
): string {
  const { signature, isDu, firstNameClean } = resolveSettings(settings, reviewerName)
  const begruessung = firstNameClean ? `Hallo ${firstNameClean},` : ''
  const kernSatz = pickRandom(isDu ? KERN_POSITIV : KERN_POSITIV_SIE)
  const gruss = pickGruss(signature)
  const teile = [begruessung, kernSatz, gruss].filter(Boolean)
  const fertigerText = teile.join(' ')
  return JSON.stringify({ _direct: fertigerText })
}

// Baut den Kern-Satz zusammen: wählt aus dem richtigen Pool und setzt nominativ ein
function buildKernSatz(cat: string, nominativ: string, isServiceComplaint = false): string {
  if (cat === 'C') return resolveKernC(nominativ)
  const pool = cat === 'B'
    ? (isServiceComplaint ? KERN_B_SERVICE : KERN_B)
    : cat === 'A' ? KERN_A
    : KERN_POSITIV
  const satz = pickRandom(pool)
  return satz.replace('[KERN]', nominativ)
}

// Wählt den richtigen Gruss-Abschluss
function pickGruss(signature: string): string {
  const optionen = [`Viele Grüße, ${signature}`, `Herzliche Grüße, ${signature}`, `Beste Grüße, ${signature}`]
  return pickRandom(optionen)
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── KATEGORIE-BLÖCKE (A / B / C) ────────────────────────────────────────────
// Werden nur in Negative- und Mixed-Prompts eingesetzt, und nur wenn Analysis
// die jeweilige Kategorie erkannt hat.

const KATEGORIE_A = `KATEGORIE A — KONZEPT ODER STRUKTURELL FIX:
Gilt wenn die Kritik etwas betrifft, das durch die Art des Ladens oder eine feste Regel bedingt ist und sich grundsaetzlich nicht aendert (Tischzeit-Limit, Lautstaerke bei vollem Haus, Oeffnungszeiten, Zahlungsmethoden).

Aufbau:
1. Gefuehl validieren (siehe Schritt 1 unten)
2. Ehrlichen Grund nennen WARUM es so ist — als einziger kurzer Satz, nicht als Rechtfertigung. Das Wort "Konzept" ist erlaubt.
   TONFALL: Der Grund-Satz soll offen klingen, nicht wie eine Tuer-zu-Aussage. Nie "Das ist halt so bei uns." oder "So sind wir nun mal." als abschliessenden Satz.
   BEI AUSLASTUNGSABHAENGIGER KRITIK (laut, warm, eng — Formulierungen wie "bei vollem Haus", "wenn viel los ist", "zu Stosszeiten"): Formuliere als NATUERLICHE FOLGE von gut besuchtem Betrieb — NICHT als bewusste Design-Entscheidung. RICHTIG: "Wenn bei uns viel los ist, wird's naturgemäss etwas lebhafter — das liegt daran, dass wir dann gut besucht sind." FALSCH: "Das gehoert bei uns zum Konzept." oder "Das ist eine bewusste Entscheidung."
   BEI FESTER EIGENSCHAFT (Tischabstand, Raumkonzept): Erklaere den praktischen Grund dahinter — in einem Satz, ohne "bewusst", ohne "Konzept", ohne "so sind wir". Nur: warum macht das fuer den Betrieb Sinn.
   GRENZE ZU PUNKT 3: Der Grund-Satz erklaert NUR warum die Regel existiert. Er nennt KEINE Alternative und KEINE Option fuer den Gast (kein "Bar", "Stehtisch", "anrufen" hier) — das gehoert ausschliesslich in Punkt 3. Sonst verschmelzen Erklaerung und Abschluss zu einem einzigen Erklaerungsfluss ohne Bruch.
3. Abschluss: NEUER, eigenstaendiger Gedanke (nicht Fortsetzung von Punkt 2). Leite aus dem genannten Grund die konkrete Handlungsoption fuer den naechsten Besuch ab. Direkte Anrede, nie "man" oder "wer". Keine Wiederholung des Gefuehls aus Schritt 1.
   WENN das Profil sowohl eine Bar/Steh-Option als auch reservierbare Tische kennt UND die Bewertung sich auf die Bar-Verweisung/Tischregel bezieht: beide Optionen nennen (spontan vorbeikommen fuers Getraenk, reservieren fuers Essen — die genaue Art der Reservierung NUR so beschreiben, wie es im Profil steht, kein "anrufen" annehmen wenn das Profil nichts dazu sagt) — nicht nur eine davon.
   SONST: eine einzige passende Option aus dem Profil.
   WENN das Profil bei der Hausregel KEINEN konkreten Tipp nennt:
   - Bei TISCHZEIT- / Zeitfenster-Kritik: Schlage vor, den Abend nach dem Zeitfenster an der Bar oder an Stehtischen ausklingen zu lassen. Beispiel: "Falls ihr danach noch bleiben wollt, wechselt einfach an die Bar oder an einen Stehtisch."
   - Bei LAUTSTAERKE- / AUSLASTUNGS-Kritik: "Zu ruhigeren Zeiten ist's da meist entspannter."
   WICHTIG: Diese Fallbacks NUR bei Kategorie A (Hausregeln). NIEMALS bei Essen oder Geschmack.
KEIN oeffentliches Versprechen, etwas strukturell zu aendern.`

const KATEGORIE_B = (servicebeschwerdeSatz: string) => `KATEGORIE B — ECHTER FEHLER, EINZELFALL:
Gilt wenn die Kritik einen objektiven Fehler beschreibt (falsches Gericht, lange Wartezeit ohne Grund, unfreundliches Personal) der NICHT durch Konzept bedingt ist.

SONDERFALL SERVICEBESCHWERDE (nur unfreundliches Personal / schlechtes Verhalten):
Wenn die Bewertung ueber unfreundliches oder schlechtes Verhalten des Personals klagt — auch wenn zusaetzlich ein C-Thema (Geschmack/Wahrnehmung) vorkommt — gilt eine eigene Struktur:
Struktur: (1) Verwende sinngemäss diesen Satz: "${servicebeschwerdeSatz}" (2) Kontakt anbieten: "Meld dich gerne bei uns" + contactEmail + "dann kuemmern wir uns persoenlich darum."
KEIN "komm nochmal vorbei". KEIN C-Anhang ("Was die Pommes betrifft..." etc.) — alles wird im persoenlichen Gespraech geklaert. KEIN weiterer Satz nach dem Kontaktangebot.

Aufbau (fuer alle anderen B-Faelle — falsches Gericht, Wartezeit, technische Fehler):
1. Gefuehl validieren (siehe Schritt 1 unten)
2. Verantwortung uebernehmen, OHNE zu rechtfertigen. Keine Auslastungs-Begruendung wenn die Bewertung das Gegenteil beschreibt.
3. Abschluss:
   - Hat der Gast das Problem VOR ORT geloest? Nur kurze Anerkennung, kein weiterer Ausblick.
   - Problem WAEHREND Besuch moeglich zu melden? Geste: "Wink uns kurz, dann kuemmern wir uns gleich."
   - Problem erst spaeter bemerkt? Einladung ohne Schuldzuweisung: "Komm gerne nochmal vorbei, das geht besser."
   WORTWAHL VOR ORT: Wenn die Geste sich auf eine Situation WAEHREND des Besuchs bezieht (Personal/Tisch/Bezahlen), vermeide Fernkommunikations-Woerter wie "ruf uns", "anrufen", "melden", "kontaktieren", "Rueckmeldung" — das klingt nach Telefon, nicht nach vor Ort sein. Nutze stattdessen Woerter fuer persoenliche Anwesenheit, z.B. winken, kurz Bescheid geben, ansprechen, dem Personal sagen.
VERBOTEN: "intern nachgeschaerft", "dem Team mitgeteilt", "Massnahmen", interne Ablaeufe erklaeren, "wir nehmen das mit".`

const KATEGORIE_C = `KATEGORIE C — SUBJEKTIV / GESCHMACK / WAHRNEHMUNG:
Gilt wenn die Kritik eine persoenliche Geschmacks- oder Wahrnehmungssache ist (zu scharf, zu wenig Portion, nicht gemuetlich) bei der NICHTS objektiv falsch gelaufen ist.

Aufbau:
1. Validiere mit "Schade, dass..." + das KONKRETE Merkmal aus der Bewertung (z.B. "Schade, dass die Wuerze bei den Pommes nicht ganz gepasst hat.")
   VERBOTEN: "Geschmaecker sind halt verschieden" — isoliert den Gast.
   VERBOTEN: "kann nachvollziehen, dass..." fuer reine Geschmackssachen.
   SERVICE-WAHRNEHMUNG (kein konkreter Vorwurf, nur Eindruck): "Dass der Besuch diesen Eindruck hinterlassen hat, bedauern wir." — nicht auf "das Team" verallgemeinern wenn es um eine Person geht.
2. Hat der Gast AUCH etwas gelobt? Das echte Lob ZUERST aufgreifen, dann Kritik validieren.
3. Abschluss — Geste fuer naechsten Besuch:
   ANPASSBARES MERKMAL (Schaerfe, Suesse, Temperatur): "Sag uns beim naechsten Besuch kurz Bescheid, dann machen wir's [kraeftiger/wuerzen wir nach] fuer dich."
   REINE STILSACHE ohne anpassbares Merkmal: "Sag uns, was dir eher zusagt, dann empfehlen wir dir naechstes Mal etwas Passendes."
   PORTION SUBJEKTIV: KEIN vager Nachschlag-Hinweis. Stattdessen: "dann koennen wir dir was passend zu deinem Hunger empfehlen."
KEIN Strukturversprechen (nicht versprechen, ein Gericht oder Konzept allgemein zu aendern).`

// ─── PROMPT: POSITIV (4–5 Sterne) ────────────────────────────────────────────

// ─── PROMPT: MIXED (3 Sterne) ─────────────────────────────────────────────────

// ─── LOB-EINSTIEG & ABER-BRÜCKE (für Mixed-Pfad) ────────────────────────────

const LOB_EINSTIEG: string[] = [
  "Schön, dass [LOB].",
  "Gut zu hören, dass [LOB].",
  "Freut uns, dass [LOB].",
]

const ABER_BRUECKE_B = "Schade, dass es bei deinem Besuch nicht alles so rund gelaufen ist."
const ABER_BRUECKE_B_SIE = "Schade, dass es bei Ihrem Besuch nicht alles so rund gelaufen ist."
const ABER_BRUECKE_C = "Schade, dass wir dich diesmal nicht ganz überzeugen konnten."
const ABER_BRUECKE_C_SIE = "Schade, dass wir Sie diesmal nicht ganz überzeugen konnten."

// Abschluss-Bausteine nach Weg — als Funktion wegen Du/Sie
function getAbschlussWeg1(isDu: boolean): string {
  return isDu
    ? "Beim nächsten Mal einfach kurz ansprechen, wir finden dann gemeinsam was Passendes für dich."
    : "Beim nächsten Mal einfach kurz ansprechen, wir finden dann gemeinsam was Passendes für Sie."
}
function getAbschlussWeg2(isDu: boolean): string {
  return isDu
    ? "Sollte bei einem zukünftigen Besuch etwas nicht perfekt laufen, bitten wir dich, unser Team vor Ort direkt anzusprechen, damit wir den Fehler zeitnah korrigieren können."
    : "Sollte bei einem zukünftigen Besuch etwas nicht perfekt laufen, bitten wir Sie, unser Team vor Ort direkt anzusprechen, damit wir den Fehler zeitnah korrigieren können."
}

function buildMixedPrompt(
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any,
  analysis?: Analysis
): string {
  const { signature, isDu, firstNameClean, contactEmail } = resolveSettings(settings, reviewerName)

  const begruessung = firstNameClean ? `Hallo ${firstNameClean},` : ''

  // Lob-Einstieg wenn Lob vorhanden
  const lobEinstieg = analysis?.lobpunkte?.length
    ? pickRandom(LOB_EINSTIEG).replace('[LOB]', analysis.lobpunkte[0])
    : ''

  // Kern-Satz aus den 12 Bausteinen
  const hauptkat = analysis?.categories?.[0] || 'B'
  const nominativ = analysis?.nominative?.[0] || analysis?.points?.[0] || 'dieser Punkt'
  const kernSatz = buildKernSatz(hauptkat, nominativ, analysis?.isServiceComplaint || false)

  // Abschluss: 3 Wege je nach Situation
  const emailAbschlussOptionen = isDu ? [
    contactEmail ? `Meld dich gerne direkt bei uns unter ${contactEmail}, dann klären wir das gerne persönlich.` : 'Meld dich gerne direkt bei uns, dann klären wir das gerne persönlich.',
    contactEmail ? `Meld dich gerne direkt bei uns unter ${contactEmail}, damit wir uns deiner Sache direkt annehmen können.` : 'Meld dich gerne direkt bei uns, damit wir uns deiner Sache direkt annehmen können.',
    contactEmail ? `Meld dich gerne direkt bei uns unter ${contactEmail}, dann schauen wir gemeinsam drauf.` : 'Meld dich gerne direkt bei uns, dann schauen wir gemeinsam drauf.',
  ] : [
    contactEmail ? `Melden Sie sich gerne direkt bei uns unter ${contactEmail}, dann klären wir das gerne persönlich.` : 'Melden Sie sich gerne direkt bei uns, dann klären wir das gerne persönlich.',
    contactEmail ? `Melden Sie sich gerne direkt bei uns unter ${contactEmail}, damit wir uns Ihrer Sache direkt annehmen können.` : 'Melden Sie sich gerne direkt bei uns, damit wir uns Ihrer Sache direkt annehmen können.',
    contactEmail ? `Melden Sie sich gerne direkt bei uns unter ${contactEmail}, dann schauen wir gemeinsam drauf.` : 'Melden Sie sich gerne direkt bei uns, dann schauen wir gemeinsam drauf.',
  ]

  let abschluss: string
  if (analysis?.ambiguousB) {
    abschluss = pickRandom(emailAbschlussOptionen)
  } else if (analysis?.isServiceComplaint) {
    abschluss = getAbschlussWeg2(isDu)
  } else {
    abschluss = getAbschlussWeg1(isDu)
  }

  const gruss = pickGruss(signature)
  const aberBruecke = hauptkat === 'C'
    ? d(isDu, ABER_BRUECKE_C, ABER_BRUECKE_C_SIE)
    : d(isDu, ABER_BRUECKE_B, ABER_BRUECKE_B_SIE)

  const teile = [begruessung, lobEinstieg, aberBruecke, kernSatz, abschluss, gruss].filter(Boolean)
  const fertigerText = teile.join(' ')

  return JSON.stringify({ _direct: fertigerText })
}

// ─── PROMPT: NEGATIV (1–2 Sterne) — SLIM v7 ──────────────────────────────────

function buildComboPrompt(
  combo: CategoryCombo,
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any,
  analysis: Analysis
): string {
  const { signature, duSie, isDu, firstNameClean, langInstruction, context, contactEmail } = resolveSettings(settings, reviewerName)

  const duForm = duSie === 'Sie' ? 'Sie' : 'du'
  const besuchForm = isDu ? 'dein Besuch' : 'Ihr Besuch'

  // Validierungssatz-Rotation
  // Sack 1: Klare Fehler (Steak durch, Haar im Essen, falsches Gericht)
  const bClearFault = [
    `Da sind wir klar an ${duForm} vorbeigegangen.`,
    `Da ist uns ein Fehler unterlaufen.`,
    `Das darf bei uns einfach nicht passieren.`,
    `Das haetten wir sofort korrigieren muessen.`,
  ]

  // Sack 2: Unklare Fehler / moegliche Missverstaendnisse
  const bAmbiguousFault = [
    `Dass da etwas nicht gestimmt haben soll, aergert uns.`,
    `Da scheint etwas schiefgelaufen zu sein.`,
    `Das haetten wir gerne gleich vor Ort geklaert.`,
    `Da schauen wir gerne genauer hin.`,
  ]

  const vs = analysis?.ambiguousB
    ? bAmbiguousFault[Math.floor(Math.random() * bAmbiguousFault.length)]
    : bClearFault[Math.floor(Math.random() * bClearFault.length)]

  // A-spezifischer Validierungssatz — pronomen-aware
  const aValidierungsSaetzeDu = [
    `Dass das bei euch so gelaufen ist, finden wir schade.`,
    `Dass dieser Eindruck entstanden ist, bedauern wir.`,
    `Dass du deinen Besuch so in Erinnerung behaeltst, finden wir schade.`,
    `Dass dein Besuch diesen Eindruck hinterlassen hat, bedauern wir.`,
  ]
  const aValidierungsSaetzeSie = [
    `Dass das bei Ihrem Besuch so gelaufen ist, finden wir schade.`,
    `Dass dieser Eindruck entstanden ist, bedauern wir.`,
    `Dass Sie Ihren Besuch so in Erinnerung behalten, finden wir schade.`,
    `Dass Ihr Besuch diesen Eindruck hinterlassen hat, bedauern wir.`,
  ]
  const avsPool = duSie === 'Sie' ? aValidierungsSaetzeSie : aValidierungsSaetzeDu
  const avs = avsPool[Math.floor(Math.random() * avsPool.length)]

  // Servicebeschwerde-Satz-Rotation
  const serviceSaetze = [
    `natuerlich sollte kein Gast bei uns mit diesem Gefuehl nach Hause gehen.`,
    `So soll sich kein Gast bei uns fuehlen.`,
    `Das ist nicht, wie wir uns den Besuch unserer Gaeste vorstellen.`,
  ]
  const ss = serviceSaetze[Math.floor(Math.random() * serviceSaetze.length)]

  const kontakt = isDu
    ? (contactEmail ? `Meld dich gerne direkt bei uns unter ${contactEmail}, dann klären wir das persönlich.` : `Meld dich gerne direkt bei uns, dann klären wir das persönlich.`)
    : (contactEmail ? `Melden Sie sich gerne direkt bei uns unter ${contactEmail}, dann klären wir das persönlich.` : `Melden Sie sich gerne direkt bei uns, dann klären wir das persönlich.`)

  const comboInstructions: Record<CategoryCombo, string> = {

    'A_ONLY': `STRUKTUR (exakt einhalten — 3 Saetze, nicht mehr):
SATZ 1 — VALIDIERUNG: Verwende sinngemäss: "${avs}"
SATZ 2 — ERKLAERUNG: Erklaere kurz und natuerlich WARUM diese Regel existiert. Kontext: ${analysis?.topicA?.situation || 'siehe Restaurantprofil'}. NUR mit Infos aus dem Restaurantprofil — kein Erfinden.
SATZ 3 — OPTION: ${analysis?.topicA?.barOption
  ? 'Biete konkret an, nach der Tischzeit an Bar oder Stehtischen weiterzumachen. Neutrale Formulierung ohne Anrede-Pronomen: "Wer danach noch bleiben moechte, kann an die Bar wechseln."'
  : 'Nenne eine konkrete Handlungsoption aus dem Profil. Wenn keine passt: "Zu ruhigeren Zeiten ist es da meist entspannter."'
}
NACH SATZ 3: Direkt Grussformel. KEIN weiterer Satz. KEIN Strukturversprechen.`,

    'B_ONLY': `STRUKTUR (exakt einhalten):
1. Validierungssatz (sinngemäss): "${vs}"
2. VERANTWORTUNG — kurz und nuechtern, maximal ein Satz:
   ERLAUBT: "Das haette nicht passieren duerfen." / "Da sind wir klar am Gast vorbei." / "Das haetten wir direkt korrigieren sollen."
   VERBOTEN: Den Standard aggressiv verteidigen ("nicht verhandelbar", "steht fuer uns ausser Frage", "ein absolutes Muss"). Keine Rechtfertigung, kein Erklaeren von Ablaeufen.
3. Abschluss je nach Situation:
   - Problem waehrend Besuch meldbar (Gargrad, falsches Gericht, Wartezeit): "Sag uns beim naechsten Besuch direkt Bescheid, dann klaeren wir das sofort vor Ort."
   - Erst spaeter bemerkt: "Komm gerne nochmal vorbei, das geht besser."
   - Vor Ort bereits geloest: Kurze Anerkennung, kein weiterer Ausblick.
VERBOTEN: "intern nachgeschaerft", "dem Team mitgeteilt", "Massnahmen", "wir nehmen das mit", "tut uns leid".`,

    'C_ONLY': `STRUKTUR (exakt einhalten):
VERBOTEN: Das eigene Rezept oder Konzept verteidigen ("ist fuer uns das Wesentliche", "legen wir grossen Wert darauf", "gehoert zu unserem Konzept", "Saftigkeit ist fuer uns keine Kleinigkeit"). Der Gast hat sein Recht auf seinen Geschmack.
VERBOTEN: "nehmen wir ernst", "nehmen wir das Feedback auf", "werden wir anpassen" als generelles Versprechen.
1. Erkenne an, dass das spezifische Merkmal (Geschmack, Konsistenz, Gargrad, Portion) nicht zur Erwartung passte. Formuliere einen natuerlichen, vollstaendigen deutschen Satz. VERBOTEN: Den genauen Wortlaut der Kritik in ein starres "Schade, dass...nicht gepasst hat"-Schema pressen.
2. Falls Lob vorhanden: Lob zuerst aufgreifen, dann Kritik.
3. Abschluss:
   - Anpassbares Merkmal (Schaerfe, Wuerze, Gargrad, Temperatur): "Sag uns beim naechsten Besuch kurz Bescheid, dann passen wir das direkt an."
   - Reine Stilsache: "Sag uns, was dir eher zusagt, dann empfehlen wir naechstes Mal etwas Passendes."
   - Portion: "dann koennen wir dir was passend zu deinem Hunger empfehlen."
KEIN "Geschmaecker sind verschieden". KEIN Strukturversprechen. KEIN Kontakt-E-Mail.`,

    'AB': `STRUKTUR (exakt einhalten — 4 Schritte):
1. Validierungssatz (sinngemäss): "${avs}"
2. A-Teil: Erklaere kurz und natuerlich WARUM diese Regel existiert. Kontext: ${analysis?.topicA?.situation || 'siehe Restaurantprofil'}. NUR aus Profil — nie erfinden. ${analysis?.topicA?.barOption ? 'Schliesse diesen Satz mit dem Angebot ab, nach der Tischzeit an der Bar oder Stehtischen weiterzumachen. Neutrale Formulierung ohne Anrede-Pronomen: "Wer danach noch bleiben moechte, kann gerne an die Bar wechseln."' : ''}
3. B-Teil (kurz, ein Halbsatz): ${analysis?.ambiguousB
    ? `VERWENDE GENAU: "Dass da etwas mit der Rechnung nicht gestimmt hat, klaeren wir gerne per Mail${contactEmail ? ' unter ' + contactEmail : ''}." KEIN Entschuldigungs-Wort, KEIN "Fehler", KEIN Anrede-Pronomen.`
    : 'Uebernimm kurz Verantwortung fuer den echten Fehler, ein Halbsatz genuegt.'}
4. ABSCHLUSS: Das A-Thema hat den vollen Abschluss (Bar-Option falls relevant). Der B-Teil ist bereits Schritt 3 — KEIN weiterer Satz danach.
Direkt Grussformel. NICHTS mehr.`,

    'BC': `STRUKTUR (exakt einhalten):
1. Validierungssatz (sinngemäss): "${vs}"
2. Zusammenfassend: "Da scheint bei uns einiges nicht rundgelaufen zu sein."
3. ABSCHLUSS-PRIORITAET — FEST: Das in der Bewertung ZUERST genannte Thema bekommt den VOLLEN Abschluss. Das zweite Thema NUR als kurzer Halbsatz mit "und" angehaengt, direkt im selben Satz.
Nach dem Abschluss-Satz direkt Grussformel. NICHTS mehr.`,

    'AC': `STRUKTUR (exakt einhalten):
1. Validierungssatz (sinngemäss): "${avs}"
2. A-Thema erklaeren — NUR aus Profil. Ein Satz.
3. C-Abschluss: "Und wenn [C-Merkmal] wieder nicht stimmt, sag beim naechsten Besuch kurz Bescheid, dann [Anpassung]."
Nach dem Abschluss direkt Grussformel. NICHTS mehr.`,

    'ABC': `STRUKTUR (exakt einhalten) — A WIRD GETRENNT BEHANDELT:
1. Validierungssatz (sinngemäss): "${avs}"
2. A-Thema erklaeren: "Was [A-Thema] betrifft: [Grund aus Profil]" — NUR ein Satz, kein Mehr.
3. B+C in EINEM einzigen Satz zusammenfassen — VERBOTEN: einzelne Punkte namentlich nennen oder aufzaehlen. Kein "X und Y sind Dinge die...". Nur: "Dass dabei noch einiges nicht gestimmt hat, bedauern wir."
4. Abschluss: "${kontakt}"
NACH DEM KONTAKT-SATZ: Direkt Grussformel. KEIN weiterer Satz.`,

    'B_SERVICE': `STRUKTUR (exakt einhalten) — SONDERFALL, KEIN NORMALER ABLAUF:
KEIN Validierungssatz. Direkt starten nach der Begruessung:
1. "${ss}"
2. "${kontakt}"
ZWISCHEN SATZ 1 UND KONTAKT: KEIN weiterer Satz. KEIN Aufzaehlen von Punkten. KEIN "X und Y sind Dinge die...". KEIN Zusammenfassen. Direkt von Satz 1 zu Kontakt.
NACH DEM KONTAKT-SATZ: Direkt Grussformel. NICHTS mehr.`,
  }

  // ── Kern-Satz aus den 12 Bausteinen zusammenbauen ───────────────────────────
  // Hauptkategorie bestimmen (erste erkannte Kategorie)
  const hauptkat = analysis.categories[0] || 'B'
  const nominativ = analysis.nominative[0] || analysis.points[0] || 'dieser Punkt'
  const kernSatz = buildKernSatz(hauptkat, nominativ, analysis.isServiceComplaint)

  // Begrüßung
  const begruessung = firstNameClean ? `Hallo ${firstNameClean},` : ''

  // E-Mail Abschluss-Varianten (rotierend)
  const emailAbschlussOptionen = isDu ? [
    contactEmail ? `Meld dich gerne direkt bei uns unter ${contactEmail}, dann klären wir das gerne persönlich.` : 'Meld dich gerne direkt bei uns, dann klären wir das gerne persönlich.',
    contactEmail ? `Meld dich gerne direkt bei uns unter ${contactEmail}, damit wir uns deiner Sache direkt annehmen können.` : 'Meld dich gerne direkt bei uns, damit wir uns deiner Sache direkt annehmen können.',
    contactEmail ? `Meld dich gerne direkt bei uns unter ${contactEmail}, dann schauen wir gemeinsam drauf.` : 'Meld dich gerne direkt bei uns, dann schauen wir gemeinsam drauf.',
  ] : [
    contactEmail ? `Melden Sie sich gerne direkt bei uns unter ${contactEmail}, dann klären wir das gerne persönlich.` : 'Melden Sie sich gerne direkt bei uns, dann klären wir das gerne persönlich.',
    contactEmail ? `Melden Sie sich gerne direkt bei uns unter ${contactEmail}, damit wir uns Ihrer Sache direkt annehmen können.` : 'Melden Sie sich gerne direkt bei uns, damit wir uns Ihrer Sache direkt annehmen können.',
    contactEmail ? `Melden Sie sich gerne direkt bei uns unter ${contactEmail}, dann schauen wir gemeinsam drauf.` : 'Melden Sie sich gerne direkt bei uns, dann schauen wir gemeinsam drauf.',
  ]
  const emailAbschluss = pickRandom(emailAbschlussOptionen)

  // Abschluss-Satz je nach Combo
  const abschlussMap: Record<CategoryCombo, string> = {
    'A_ONLY': analysis?.topicA?.barOption
      ? d(isDu, 'Wer danach noch bleiben möchte, ist an der Bar oder an den Stehtischen herzlich willkommen.', 'Wer danach noch bleiben möchte, ist an der Bar oder an den Stehtischen herzlich willkommen.')
      : d(isDu, 'Zu ruhigeren Zeiten ist es da meist entspannter.', 'Zu ruhigeren Zeiten ist es da meist entspannter.'),
    'B_ONLY': analysis.vorOrtErwaehnt
      ? d(isDu, 'Schön, dass du das direkt angesprochen hast.', 'Schön, dass Sie das direkt angesprochen haben.')
      : analysis.ambiguousB
        ? emailAbschluss
        : d(isDu, 'Sollte bei einem zukünftigen Besuch etwas nicht perfekt laufen, bitten wir dich, unser Team vor Ort direkt anzusprechen, damit wir den Fehler zeitnah korrigieren können.', 'Sollte bei einem zukünftigen Besuch etwas nicht perfekt laufen, bitten wir Sie, unser Team vor Ort direkt anzusprechen, damit wir den Fehler zeitnah korrigieren können.'),
    'C_ONLY': d(isDu, 'Sag uns beim nächsten Besuch kurz Bescheid, dann empfehlen wir dir etwas Passendes.', 'Sagen Sie uns beim nächsten Besuch kurz Bescheid, dann empfehlen wir Ihnen etwas Passendes.'),
    'AB': analysis?.topicA?.barOption
      ? 'Wer danach noch bleiben möchte, ist an der Bar oder an den Stehtischen herzlich willkommen.'
      : emailAbschluss,
    'BC': emailAbschluss,
    'AC': d(isDu, 'Sag uns beim nächsten Besuch kurz Bescheid, dann empfehlen wir dir etwas Passendes.', 'Sagen Sie uns beim nächsten Besuch kurz Bescheid, dann empfehlen wir Ihnen etwas Passendes.'),
    'ABC': emailAbschluss,
    'B_SERVICE': emailAbschluss,
  }
  const abschluss = abschlussMap[combo] || abschlussMap['B_ONLY']
  const gruss = pickGruss(signature)

  // Lob-Einstieg wenn Lob vorhanden
  const lobEinstieg = analysis.lobpunkte?.length
    ? pickRandom(LOB_EINSTIEG).replace('[LOB]', analysis.lobpunkte[0])
    : ''
  const aberBruecke = lobEinstieg
    ? (hauptkat === 'C'
        ? d(isDu, ABER_BRUECKE_C, ABER_BRUECKE_C_SIE)
        : d(isDu, ABER_BRUECKE_B, ABER_BRUECKE_B_SIE))
    : ''

  const teile = [begruessung, lobEinstieg, aberBruecke, kernSatz, abschluss, gruss].filter(Boolean)
  const fertigerText = teile.join(' ')

  // Kein KI-Call nötig — Text ist fertig. _direct signalisiert generateVariant den direkten Pfad.
  return JSON.stringify({ _direct: fertigerText })
}

// ─── PROMPT: EMPTY POSITIVE (4-5 Sterne, kein oder kaum Text) ─────────────────

// ─── EMPTY POSITIV: 3 feste Sätze ────────────────────────────────────────────
const KERN_EMPTY_POSITIV: string[] = [
  "5 Sterne sagen mehr als tausend Worte. Bis zum nächsten Besuch.",
  "Danke für die 5 Sterne. Wir freuen uns auf dein nächstes Mal.",
  "Perfekt, mehr geht nicht. Bis bald.",
]
const KERN_EMPTY_POSITIV_SIE: string[] = [
  "5 Sterne sagen mehr als tausend Worte. Bis zum nächsten Besuch.",
  "Danke für die 5 Sterne. Wir freuen uns auf Ihren nächsten Besuch.",
  "Perfekt, mehr geht nicht. Bis bald.",
]

function buildEmptyPositivePrompt(
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any
): string {
  const { signature, isDu, firstNameClean } = resolveSettings(settings, reviewerName)
  const begruessung = firstNameClean ? `Hallo ${firstNameClean},` : ''
  const kernSatz = pickRandom(isDu ? KERN_EMPTY_POSITIV : KERN_EMPTY_POSITIV_SIE)
  const gruss = pickGruss(signature)
  const teile = [begruessung, kernSatz, gruss].filter(Boolean)
  return JSON.stringify({ _direct: teile.join(' ') })
}

// ─── EMPTY NEGATIV: 3 feste Sätze + E-Mail immer drin ───────────────────────
const KERN_EMPTY_NEGATIV: string[] = [
  "Ein Stern ohne Text macht es schwer zu verstehen, was bei deinem Besuch nicht gestimmt hat.",
  "Schade, dass es nicht gepasst hat. Schreib uns kurz was los war, dann können wir helfen.",
  "Ein Stern ist deutlich. Wir würden gerne wissen was passiert ist.",
]
const KERN_EMPTY_NEGATIV_SIE: string[] = [
  "Ein Stern ohne Text macht es schwer zu verstehen, was bei Ihrem Besuch nicht gestimmt hat.",
  "Schade, dass es nicht gepasst hat. Schreiben Sie uns kurz was los war, dann können wir helfen.",
  "Ein Stern ist deutlich. Wir würden gerne wissen was passiert ist.",
]

function buildEmptyNegativePrompt(
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any
): string {
  const { signature, isDu, firstNameClean, contactEmail } = resolveSettings(settings, reviewerName)
  const begruessung = firstNameClean ? `Hallo ${firstNameClean},` : ''
  const kernSatz = pickRandom(isDu ? KERN_EMPTY_NEGATIV : KERN_EMPTY_NEGATIV_SIE)
  const emailOptionen = isDu ? [
    contactEmail ? `Meld dich gerne direkt bei uns unter ${contactEmail}, dann klären wir das gerne persönlich.` : 'Meld dich gerne direkt bei uns, dann klären wir das gerne persönlich.',
    contactEmail ? `Meld dich gerne direkt bei uns unter ${contactEmail}, damit wir uns deiner Sache direkt annehmen können.` : 'Meld dich gerne direkt bei uns, damit wir uns deiner Sache direkt annehmen können.',
    contactEmail ? `Meld dich gerne direkt bei uns unter ${contactEmail}, dann schauen wir gemeinsam drauf.` : 'Meld dich gerne direkt bei uns, dann schauen wir gemeinsam drauf.',
  ] : [
    contactEmail ? `Melden Sie sich gerne direkt bei uns unter ${contactEmail}, dann klären wir das gerne persönlich.` : 'Melden Sie sich gerne direkt bei uns, dann klären wir das gerne persönlich.',
    contactEmail ? `Melden Sie sich gerne direkt bei uns unter ${contactEmail}, damit wir uns Ihrer Sache direkt annehmen können.` : 'Melden Sie sich gerne direkt bei uns, damit wir uns Ihrer Sache direkt annehmen können.',
    contactEmail ? `Melden Sie sich gerne direkt bei uns unter ${contactEmail}, dann schauen wir gemeinsam drauf.` : 'Melden Sie sich gerne direkt bei uns, dann schauen wir gemeinsam drauf.',
  ]
  const kontakt = pickRandom(emailOptionen)
  const gruss = pickGruss(signature)
  const teile = [begruessung, kernSatz, kontakt, gruss].filter(Boolean)
  return JSON.stringify({ _direct: teile.join(' ') })
}

// ─── DISPATCHER: Wählt den richtigen Prompt nach Klassifizierung ──────────────

function buildPrompt(
  mode: string,
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any,
  analysis?: Analysis
): string {
  switch (mode) {
    case 'EMPTY_POSITIVE': return buildEmptyPositivePrompt(reviewText, stars, reviewerName, settings)
    case 'EMPTY_NEGATIVE': return buildEmptyNegativePrompt(reviewText, stars, reviewerName, settings)
    case 'CONTENT_POSITIVE': return buildPositivePrompt(reviewText, stars, reviewerName, settings)
    case 'CONTENT_MIXED':   return buildMixedPrompt(reviewText, stars, reviewerName, settings, analysis)
    case 'CONTENT_NEGATIVE': return buildComboPrompt(resolveCombo(analysis!), reviewText, stars, reviewerName, settings, analysis!)
    default: return buildComboPrompt(resolveCombo(analysis!), reviewText, stars, reviewerName, settings, analysis!)
  }
}

// ─── RECOVERY PROMPT (1–2 Sterne, separater 4. Slot) ─────────────────────────

function buildRecoveryPrompt(reviewText: string, reviewerName: string, settings: any): string {
  const { signature, duSie, firstNameClean, langInstruction, context, contactEmail } = resolveSettings(settings, reviewerName)

  const systemPrompt = `Erstelle eine deeskalierende, menschliche Antwort auf eine sehr negative Google-Bewertung.
Schreibe wie ein aufmerksamer Gastronom — nicht wie Kundenservice oder KI.

${FORMAT_RULES}

VERBOTEN: "nehmen wir sehr ernst", "intern adressiert", "Massnahmen ergriffen", "Team sensibilisiert", "nicht das wofuer wir stehen".

ZIEL: Vertrauen zurueckgewinnen und persoenliche Klaerung anbieten.
LAENGE: 3-4 vollstaendige, fliessende Saetze.
ERSTER SATZ: Kurze, ehrliche Gefuehls-Validierung — was hat sich fuer den Gast im Moment so angefuehlt? Kein Schuld-Eingestaendnis, nur echtes Verstaendnis.`

  const userMessage = `${langInstruction} Anredeform: ${duSie}

RESTAURANTPROFIL:
${context}
${contactEmail ? `Kontakt-E-Mail: ${contactEmail}` : ''}

Bewertung von ${firstNameClean || 'einem Gast'} (1-2 Sterne):
"${reviewText}"

Schreibe EINE deeskalierende Antwort.
${firstNameClean ? `Beginne mit "Hallo ${firstNameClean},"` : 'Kein Name — ohne persoenliche Anrede.'}
${contactEmail ? `Kontaktangebot: Bitte melde dich kurz unter ${contactEmail}, damit wir das persoenlich klaeren koennen.` : ''}
Endet mit: ${signature}

AUSGABE — NUR dieses JSON:
{"label":"Deeskalierend","text":"..."}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── CLAUDE API CALL ──────────────────────────────────────────────────────────

async function callClaude(userMessage: string, systemPrompt?: string, model = 'claude-sonnet-4-6', temperature = 0.4): Promise<string> {
  const body: any = {
    model,
    max_tokens: 4000,
    temperature,
    messages: [{ role: 'user', content: userMessage }],
  }
  if (systemPrompt) body.system = systemPrompt

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Claude API Fehler: ${JSON.stringify(err)}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || ''
}

// ─── JSON PARSE ───────────────────────────────────────────────────────────────

function parseJson(raw: string): any {
  let s = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Kein JSON gefunden: ' + raw)
  return JSON.parse(s.substring(start, end + 1))
}

const cleanText = (t: string) => t.replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim()

// ─── POST-PROCESSING: DETERMINISTISCHER REGEX-CHECK ──────────────────────────

const FORBIDDEN_OPENERS = [
  /vielen?\s+dank\s+f[üu]r\s+(ihre?|deine?|ihr)\s+(ausf[üu]hrliche?\s+)?(bewertung|feedback|einsch[äa]tzung|rezension)/i,
  /danke\s+f[üu]r\s+(ihre?|deine?|ihr)\s+(ausf[üu]hrliche?\s+)?(bewertung|feedback|einsch[äa]tzung|rezension)/i,
  /danke\s+f[üu]r\s+die\s+(ausf[üu]hrliche?\s+)?(bewertung|einsch[äa]tzung|r[üu]ckmeldung)/i,
  /(es|das)\s+freut\s+uns\s+sehr/i,
  /wir\s+freuen\s+uns\s+[üu]ber\s+(ihre?|deine?|ihr)\s+(bewertung|feedback)/i,
]

function hasForbiddenOpener(text: string): boolean {
  const afterGreeting = text.replace(/^(hallo|hi|hey)\s+\w*,?\s*/i, '').trim()
  return FORBIDDEN_OPENERS.some(p => p.test(afterGreeting))
}

const CHECKS: Array<{ key: string; test: (text: string, sig: string, idx: number) => boolean }> = [
  { key: 'forbidden_opener',    test: (t) => hasForbiddenOpener(t) },
  { key: 'dash',                test: (t) => /[–—]| - /.test(t) },
  { key: 'capitulation',        test: (t) => /\bauch\s+wenn\b/i.test(t) },
  { key: 'forbidden_word',      test: (t) => /\bfrustrierend/i.test(t) },
  { key: 'internal_reference',  test: (t) => /\bintern(e|er|es|en)?\b/i.test(t) },
  { key: 'time_reference',      test: (t) => /\b(abend(s|essen)?|gruppenabend|morgens?|mittags?|mittagessen|fr[üu]hst[üu]ck|nachts?)\b/i.test(t) },
  { key: 'corporate_phrase',    test: (t) => [
      /nicht\s+das,?\s+(was|wie)\s+wir/i,
      /kein(e)?\s+erlebnis(,)?\s+das/i,
      /nicht\s+das\s+erlebnis/i,
      /nicht\s+das,?\s+wof[üu]r\s+wir\s+stehen/i,
      /entspricht\s+nicht\s+(unserem|dem|ihrem)/i,
    ].some(p => p.test(t)) },
  { key: 'pronoun_mismatch',    test: (t, sig) => /team|wir|restaurant/i.test(sig) && /\b(da\s+)?(gebe|finde|sehe|sage|denke|meine)\s+ich\b/i.test(t) },
  { key: 'apology_in_v1',      test: (t) => /tut\s+(mir|uns)\s+(wirklich\s+|aufrichtig\s+)?leid/i.test(t) },
]

const ISSUE_DESCRIPTIONS: Record<string, (sig: string) => string> = {
  forbidden_opener:   () => 'Beginnt nach der Begruessung mit verbotener Dankesfloskel. Starte direkt mit einer echten Reaktion.',
  dash:               () => 'Enthaelt Gedankenstrich (– oder —). Ersetze durch Punkt oder Komma.',
  capitulation:       () => 'Enthaelt "auch wenn" als einschraenkenden Nachsatz. Die souveraene Aussage endet ohne "auch wenn".',
  forbidden_word:     () => 'Enthaelt "frustrierend". Ersetze durch "aergerlich" oder "schade".',
  internal_reference: () => 'Verweist mit "intern" auf interne Ablaeufe. Verboten — bleibe bei der ehrlichen Aussenperspektive.',
  time_reference:     () => 'Enthaelt Tageszeit-Bezug (Abend/Morgen/Mittag). Ersetze durch "Besuch", "Aufenthalt", "Zeit bei uns".',
  corporate_phrase:   () => 'Enthaelt Konzern-Floskel ("kein Erlebnis das...", "entspricht nicht..."). Formuliere ehrlich und persoenlich.',
  pronoun_mismatch:   (sig) => `Wechselt zwischen "ich" und "wir" obwohl Signatur ein Team ist ("${sig}"). Konsequent bei "wir" bleiben.`,
  apology_in_v1:      () => '"tut mir/uns leid" ist nicht der richtige Ton. Nutze "schade" oder "aergerlich".',
}

function sanitize(variants: { label: string; text: string }[], signature: string) {
  const issuesByVariant: string[][] = []
  const flagged: string[] = []

  const result = variants.map((v, i) => {
    const issues = CHECKS.filter(c => c.test(v.text, signature, i)).map(c => c.key)
    issuesByVariant.push(issues)
    if (issues.length > 0) flagged.push(`${v.label}: ${issues.join(', ')}`)
    return { label: v.label, text: v.text }
  })

  return { variants: result, issuesByVariant, flagged }
}

// ─── FEEDBACK FÜR REGENERIERUNG ──────────────────────────────────────────────

function buildFeedback(variants: { label: string; text: string }[], issuesByVariant: string[][], judgeResult: any, signature: string): string[] {
  return variants.map((v, i) => {
    const parts: string[] = []
    for (const code of issuesByVariant[i] || []) {
      const describe = ISSUE_DESCRIPTIONS[code]
      if (describe) parts.push(describe(signature))
    }
    const judgeKey = `variant${i + 1}`
    if (judgeResult?.[judgeKey]?.ok === false && judgeResult[judgeKey].reason) {
      parts.push(judgeResult[judgeKey].reason)
    }
    return parts.length > 0 ? `${v.label}: ${parts.join(' ')}` : ''
  }).filter(Boolean)
}

// ─── JUDGE PROMPT (unveraendert aus v4) ───────────────────────────────────────

function buildFreeJudgePrompt(reviewText: string, answerText: string, signature: string): string {
  return `Du bist ein strenger Qualitaetspruefer fuer eine Restaurant-Antwort auf eine Google-Bewertung.
Deine einzige Aufgabe: Pruefen und urteilen. Du schreibst NICHTS neu.

BEWERTUNG DES GASTES:
"${reviewText}"

ZU PRUEFENDE ANTWORT:
"${answerText}"

PRUEFE AUF DIESE PUNKTE:
1. ERFUNDENE BEGRUENDUNG: Behauptet die Antwort eine Ursache die NICHT in der Bewertung steht und nicht als Moeglichkeit ("kann sein, dass...") formuliert ist? → SCHWACH
2. GRAMMATIK: Jeder Satz vollstaendig? Subjekt bei Wahrnehmungs-Verben immer der Gast, nie die Ursache? → SCHWACH wenn nein
3. NACHERZAEHLUNG: Wiederholt die Antwort Kritik woertlich statt sie einzuordnen? → SCHWACH wenn ja
4. VERBOTENE PHRASEN: "intern nachgeschaerft" / "nehmen wir sehr ernst" / "vielen Dank fuer Ihre Bewertung" als Opener? → SCHWACH
5. GEDANKENSTRICHE: "–" oder "—" vorhanden? → SOFORT SCHWACH
6. PRONOMEN: Wechselt zwischen "ich" und "wir" obwohl Signatur "${signature}" ein Team ist? → SCHWACH
7. LOB IGNORIERT: Gast erwaehnte trotz Kritik etwas Positives und Antwort ignoriert das komplett? → SCHWACH
8. INHALTLICHE BINDUNG: Enthaelt der Abschluss-Satz mindestens ein konkretes, aus der Bewertung erkennbares Element (Wort oder enge Paraphrase des tatsaechlichen Kritikpunkts)? Der Abschluss muss eindeutig auf DIESE Bewertung zurueckfuehrbar sein und nicht generisch austauschbar. Ein Abschluss-Satz der nur eine bereits vom Gast kritisierte Sache wiederholt (z.B. Gast beschwert sich ueber Bar-Verweisung, Abschluss verweist erneut nur auf die Bar ohne neue Option) gilt als NICHT ausreichend gebunden → SCHWACH. HINWEIS: Der Validierungssatz darf bei MEHREREN Kritikpunkten bewusst nur das Gesamtgefuehl ausdruecken ohne einen einzelnen Vorfall zu benennen — das ist dann KEIN Mangel, sondern gewollt.

AUSGABE — NUR dieses JSON:
{"ok": true, "reason": ""}`
}

async function checkVariant(reviewText: string, answerText: string, signature: string): Promise<{ ok: boolean; reason: string }> {
  try {
    const prompt = buildFreeJudgePrompt(reviewText, answerText, signature)
    const raw = await callClaude(prompt, undefined, 'claude-sonnet-4-6', 0)
    const parsed = parseJson(raw)
    return { ok: parsed.ok !== false, reason: parsed.reason || '' }
  } catch {
    return { ok: true, reason: '' }
  }
}

// ─── REVIEW-ANALYSE (Agent 1, Haiku) ──────────────────────────────────────────

async function analyzeReview(reviewText: string): Promise<Analysis> {
  const systemPrompt = `Rolle: Nuechterner Fakten-Extraktor fuer Restaurant-Bewertungen. Nur Datenpunkte extrahieren, keine Antwort verfassen.

Ausgabe: AUSSCHLIESSLICH valides JSON ohne Markdown:
{"issues":[{"text":"Steak Medium statt durch","cat":"B","nominativ":"falsches Steak"}],"lobpunkte":["Lob1"],"vor_ort_erwaehnt":false,"is_service_complaint":false,"ambiguous_b":false,"topic_a":null}

Regeln:
1. "issues": Liste der Kritikpunkte als Objekte mit "text", "cat" und "nominativ".
   - "text": Kritikpunkt in max. 5 Woertern. Bei Fehlern (B): IMMER Erwartung vs. Realitaet ("Steak Medium statt durch", "Pizza Salami statt Margherita"). Bei Zustand/Wahrnehmung normal ("Pommes fad", "Service unfreundlich").
   - "nominativ": Das Hauptproblem als kurzes Substantiv (1-3 Woerter) im Nominativ OHNE Artikel. Grammatikalisch korrekt als Nomen-Phrase. Beispiele: "rohes Haehnnchen", "lange Wartezeit", "fehlender Service", "fades Gericht", "kleine Portion", "laute Atmosphaere", "bargeldlose Zahlung". KEIN Verb, KEIN Satz, NUR die Nomen-Phrase.
   - "cat": Kategorie des Kritikpunkts:
     A = Konzept/strukturell (Hausregeln, Lautstaerke, Tischvergabe, Oeffnungszeiten)
     B = Echter Fehler (falsche Bestellung, Gargrad falsch, unfreundlicher Service, Wartezeit ohne Grund)
     C = Geschmack/Wahrnehmung (zu scharf, zu wenig Wuerze, fad, lasch, Portion zu klein)
     WICHTIG: "fad", "lasch", "lieblos gewuerzt" sind IMMER C — nicht B.
     SONDERFALL C-VAGE: Wenn der Gast nur sagt "hat nicht geschmeckt", "war nicht meins", "hat mir nicht gefallen" OHNE konkreten Grund (kein "zu scharf", kein "zu salzig", kein "zu wenig") — dann "nominativ" = "vage Geschmacksbeschwerde" setzen.
2. "lobpunkte": Extrahiere das Lob als flüssigen deutschen Satzteil der perfekt hinter das Wort "dass" passt. Beispiele: "dir die Pommes so gut geschmeckt haben", "die Trüffelmayonnaise ein Highlight war", "du dich bei uns wohlgefühlt hast". Leer wenn kein Lob.
3. "vor_ort_erwaehnt": true nur wenn unmissverstaendlich aus Text hervorgeht dass Gast etwas dem Personal gesagt hat.
4. "is_service_complaint": true NUR WENN cat B vorhanden UND Kritik das VERHALTEN, FREUNDLICHKEIT oder AUFMERKSAMKEIT des Personals betrifft (unfreundlich, unaufmerksam, desinteressiert, arrogant, ignoriert). false bei: Wartezeit, falscher Bestellung, technischen Fehlern.
5. "ambiguous_b": true NUR WENN der B-Punkt NICHT sofort vom Personal bestaetigt werden kann ohne nachzuschauen (z.B. Rechnung falsch, Preis stimmt nicht, zu lange gewartet, Service unfreundlich). false BEI eindeutigen physischen Fehlern die auf dem Tisch sofort sichtbar sind (z.B. Haar im Essen, Steak durch statt medium, falsches Gericht geliefert, Essen kalt, falsche Portion).
6. "topic_a": NUR ausfullen wenn mindestens ein A-Issue vorhanden. Sonst null.
   - "situation": Beschreibe in 1-2 Saetzen was die Situation des Gastes war und was die Hausregel ist. Beispiel: "Der Gast wurde nach 90 Minuten gebeten zu gehen, obwohl er noch bestellen wollte. Das Restaurant hat ein 90-Minuten-Zeitfenster pro Tisch." Neutral, keine Wertung.
   - "bar_option": true NUR wenn der Gast nach Ablauf der Tischzeit oder wegen Platzmangel weggeschickt wurde UND ein Weiterbleiben an Bar/Stehtischen eine sinnvolle Alternative waere. false bei Lautstaerke-Kritik oder anderen Konzeptregeln wo Bar keinen Sinn ergibt.`

  try {
    const result = await callClaude(`Bewertung:\n"${reviewText}"`, systemPrompt, 'claude-sonnet-4-6', 0)
    const parsed = parseJson(result)
    const issues: Array<{text: string, cat: string, nominativ?: string}> = parsed.issues || []
    const points = issues.map((i) => i.text)
    const nominative = issues.map((i) => i.nominativ || i.text)
    const categories = issues.map((i) => i.cat)
    const rawTopicA = parsed.topic_a
    const topicA: TopicA | undefined = rawTopicA ? {
      situation: rawTopicA.situation || '',
      barOption: rawTopicA.bar_option === true,
    } : undefined

    return {
      count: issues.length,
      points,
      nominative,
      categories,
      forceSummarize: issues.length >= 3,
      lobpunkte: parsed.lobpunkte || [],
      vorOrtErwaehnt: parsed.vor_ort_erwaehnt === true,
      isServiceComplaint: parsed.is_service_complaint === true,
      ambiguousB: parsed.ambiguous_b === true,
      topicA,
    }
  } catch {
    return { count: 0, points: [], nominative: [], categories: [], forceSummarize: false, lobpunkte: [], vorOrtErwaehnt: false, isServiceComplaint: false, ambiguousB: false }
  }
}

// ─── CONTEXT CHECK ────────────────────────────────────────────────────────────

async function checkContext(reviewText: string, description: string): Promise<{ ok: boolean; missing?: string }> {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 6) return { ok: true }

  const systemPrompt = `Qualitaetspruefer fuer Restaurant-Antworten.
Entscheide ob das Restaurantprofil genueg Informationen enthaelt um sicher zu antworten.

WICHTIG: Wenn das Profil leer ist oder nur Ja/Nein-Angaben (Lieferung, Parkplaetze, Barrierefreiheit
etc.) ohne jede Erklaerung enthaelt, gilt das bei einer Hausregel-Kritik IMMER als MISSING.
Ein leeres oder rein angekreuztes Profil ist NIE "ausreichend", auch wenn die Kritik allgemein klingt.

Antworte NUR mit:
OK
MISSING: [kurze Beschreibung was fehlt, max. 1 Satz auf Deutsch]

MISSING ist korrekt NUR wenn: Bewertung kritisiert eine KONKRETE HAUSREGEL (inkl. auslastungsabhaengiger
Kritik wie Lautstaerke bei vollem Haus) und Profil enthaelt dazu keine Erklaerung.
In ALLEN anderen Faellen (Service, Essen, Atmosphaere, Verhalten): OK.`

  try {
    const result = await callClaude(
      `RESTAURANTPROFIL:\n${description || '(keine Beschreibung)'}\n\nBEWERTUNG:\n"${reviewText}"\n\nAusreichend?`,
      systemPrompt, 'claude-sonnet-4-6', 0
    )
    const trimmed = result.trim()
    if (trimmed.startsWith('MISSING:')) {
      return { ok: false, missing: trimmed.replace('MISSING:', '').trim() }
    }
    return { ok: true }
  } catch {
    return { ok: true }
  }
}

// ─── RECOVERY VARIANT (separater 4. Slot, nur bei 1-2 Sternen) ───────────────

async function buildRecoveryVariant(
  reviewText: string,
  reviewerName: string,
  settings: any
): Promise<{ label: string; text: string; isRecovery: true } | null> {
  try {
    const promptStr = buildRecoveryPrompt(reviewText, reviewerName, settings)
    const parsed = JSON.parse(promptStr)
    const raw = await callClaude(parsed._user, parsed._system)
    const result = parseJson(raw)
    if (result.text) {
      return { label: result.label || 'Deeskalierend', text: cleanText(result.text), isRecovery: true }
    }
    return null
  } catch {
    return null
  }
}

// ─── HAUPT-VARIANT GENERIEREN ─────────────────────────────────────────────────
// Für CONTENT_NEGATIVE: Text wird deterministisch vom Code gebaut — kein Judge, kein Retry.
// Für alle anderen Modi: normaler Claude-Call mit Sanitizer.

async function generateVariant(
  mode: string,
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any,
  analysis: Analysis,
  signature: string
): Promise<{ label: string; text: string; isFreeTest: true } | null> {

  const promptStr = buildPrompt(mode, reviewText, stars, reviewerName, settings, analysis)
  let promptParsed: { _system?: string; _user?: string; _direct?: string } | null = null
  try {
    const p = JSON.parse(promptStr)
    promptParsed = p
  } catch { /* ignore */ }

  // ── Deterministischer Pfad (CONTENT_NEGATIVE) ────────────────────────────────
  // Text wurde bereits im buildComboPrompt zusammengebaut und in _direct abgelegt.
  if (promptParsed?._direct) {
    return { label: 'Frei (Test)', text: cleanText(promptParsed._direct), isFreeTest: true }
  }

  // ── Normaler KI-Pfad (Positiv, Mixed, Empty) ─────────────────────────────────
  const MAX_ATTEMPTS = 2
  let userMsg = promptParsed?._user || promptStr
  let lastResult: { label: string; text: string } | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = promptParsed?._system
        ? await callClaude(userMsg, promptParsed._system)
        : await callClaude(userMsg)

      const parsed = parseJson(raw)
      if (!parsed.text) break

      const candidate = { label: parsed.label || 'Frei (Test)', text: cleanText(parsed.text) }
      const { issuesByVariant, flagged } = sanitize([candidate], signature)
      lastResult = candidate

      let judgeIssue: string | null = null
      if (flagged.length === 0) {
        const judgeResult = await checkVariant(reviewText, candidate.text, signature)
        if (!judgeResult.ok) judgeIssue = judgeResult.reason
      }

      if (flagged.length === 0 && !judgeIssue) break

      if (attempt < MAX_ATTEMPTS) {
        const feedbackLines = buildFeedback([candidate], issuesByVariant, null, signature)
        if (judgeIssue) feedbackLines.push(`- ${judgeIssue}`)
        const feedbackBlock = `\n\nHINWEIS: Ein vorheriger Entwurf hatte folgende Probleme — bitte vermeide sie:\n${feedbackLines.join('\n')}`
        userMsg = (promptParsed?._user || promptStr) + feedbackBlock
      }
    } catch (e) {
      console.error(`Versuch ${attempt} fehlgeschlagen:`, e)
      break
    }
  }

  // Letzter Fallback: Gedankenstrich deterministisch ersetzen
  if (lastResult && /[–—]| - /.test(lastResult.text)) {
    const fixed = lastResult.text
      .replace(/\s*[–—]\s*|\s+-\s+/g, '. ')
      .replace(/\.\s*\./g, '.')
      .replace(/\.\s+([a-zäöüß])/g, (_, c: string) => `. ${c.toUpperCase()}`)
    lastResult = { ...lastResult, text: fixed }
  }

  // ── Post-Processing: Bar-Fallback deterministisch ────────────────────────────
  // Wenn A_ONLY und barFallbackRequired — prüfen ob Bar/Stehtisch erwähnt wurde.
  // Wenn nicht: Satz vor der Grussformel einfügen. Keine KI beteiligt.
  if (lastResult && mode === 'CONTENT_NEGATIVE' && analysis?.topicA?.barOption) {
    const hasBar = /bar|stehtisch|stehen/i.test(lastResult.text)
    if (!hasBar) {
      // Grussformel-Patterns erkennen und Satz davor einfügen
      const grussPattern = /(Viele Grüße|Herzliche Grüße|Beste Grüße|Viele Gruesse|Herzliche Gruesse|Beste Gruesse)/i
      const barSatz = 'Wer danach noch bleiben möchte, ist an der Bar oder an den Stehtischen herzlich willkommen.'
      if (grussPattern.test(lastResult.text)) {
        lastResult = {
          ...lastResult,
          text: lastResult.text.replace(grussPattern, `${barSatz} $1`)
        }
      } else {
        // Kein Gruss-Pattern gefunden — ans Ende hängen
        lastResult = { ...lastResult, text: lastResult.text.trim() + ' ' + barSatz }
      }
    }
  }

  return lastResult ? { ...lastResult, isFreeTest: true } : null
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' })

  const { review, settings } = req.body
  if (!review || typeof review !== 'object') return res.status(400).json({ error: 'review fehlt oder ist ungueltig' })

  const reviewText   = review.reviewText || ''
  const stars        = Number(review.stars) || 3
  const reviewerName = review.reviewerName || ''
  const businessName = settings?.businessName || 'das Restaurant'
  const signature    = settings?.responseSignature || `Das Team von ${businessName}`

  try {
    // ── 0: Context-Check (Haiku) ─────────────────────────────────────────────
    const contextCheck = await checkContext(reviewText, settings?.description || '')
    if (!contextCheck.ok) {
      return res.status(200).json({ success: false, missingContext: true, missingInfo: contextCheck.missing })
    }

    // ── 1: Klassifizieren + Analyse (parallel) ────────────────────────────────
    const mode = classify(stars, reviewText)
    const analysis = await analyzeReview(reviewText)
    const combo = mode === 'CONTENT_NEGATIVE' ? resolveCombo(analysis) : null
    console.log('v6 mode:', mode, '| combo:', combo, '| analysis:', analysis)

    // ── 2: Haupt-Variant + Recovery (parallel) ────────────────────────────────
    const [mainVariant, recoveryVariant] = await Promise.all([
      generateVariant(mode, reviewText, stars, reviewerName, settings, analysis, signature),
      Promise.resolve(null), // Recovery deaktiviert — kein API-Call mehr, spart Kosten
    ])

    const answers: any[] = []
    if (mainVariant) answers.push(mainVariant)
    if (recoveryVariant) answers.push(recoveryVariant)

    return res.status(200).json({ success: true, answers })

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies-v6 FEHLER:', errMsg)
    return res.status(500).json({ error: 'Serverfehler', details: errMsg })
  }
}
