import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─── TYPES (Beibehalten und erweitert) ────────────────────────────────────────

interface Settings {
  businessName?: string
  salutation?: 'Du' | 'Sie'
  contactEmail?: string
  responseSignature?: string
  responseLanguage?: 'Deutsch' | 'Englisch' | 'Sprache des Bewerters'
  description?: string
  restaurantType?: string
  cuisineType?: string
  restaurantAtmosphere?: string
  uniqueSellingPoints?: string
  priceRange?: string
}

interface Analysis {
  count: number
  points: string[]
  nominative: string[]        // z.B. "Trüffelmayonnaise"
  nominativeArtikel: string[] // z.B. "die Trüffelmayonnaise"
  pluralFlags: boolean[]      // true wenn Plural
  categories: string[]        // 'A' | 'B' | 'C'
  isServiceComplaint: boolean
  // ... weitere Felder aus v7
}

// NEU: Repräsentiert die psychologische Haltung, die der Gastronom im UI wählt
type GastronomHaltung = 'WERT_HIGHLIGHT' | 'FEHLER_KUECHE' | 'STANDARD_BETRIEB'

// ─── SHARED HELPER (Dein Du/Sie-Konzept voll integriert) ────────────────────

function resolveSettings(settings: Settings | undefined, reviewerName: string) {
  const {
    businessName = 'das Restaurant',
    salutation = 'Sie',
    contactEmail = '',
    responseSignature = '',
  } = settings || {}

  const isDu = salutation === 'Du'
  const signature = responseSignature || `Das Team von ${businessName}`
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const firstNameClean = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  return { businessName, salutation, contactEmail, signature, isDu, firstNameClean }
}

function d(isDu: boolean, duText: string, sieText: string): string {
  return isDu ? duText : sieText
}

// ─── NEU: DIE SCHABLONEN-MATRIX (Die logischen Schubladen) ────────────────────
// Jede Kategorie (A, B, C) hat fundamentale Haltungen. Diese liefern die 
// Prompts für Claude, um die 3 Swipe-Optionen zu generieren.

const HALTUNG_PROMPTS: Record<string, Record<GastronomHaltung, { du: string; sie: string }>> = {
  C: { // Subjektiv / Geschmack / Menge
    WERT_HIGHLIGHT: {
      du: "Erkläre, dass [KERN] ein hausgemachtes, edles Extra-Highlight ist, das als feine Ergänzung dient und kein billiger Sattmacher ist. Biete an, beim nächsten Mal für mehr Hunger etwas Passenderes zu empfehlen.",
      sie: "Erkläre, dass [KERN] ein hausgemachtes, edles Extra-Highlight ist, das als feine Ergänzung dient und kein billiger Sattmacher ist. Biete an, beim nächsten Mal für den größeren Appetit etwas Passenderes zu empfehlen."
    },
    FEHLER_KUECHE: {
      du: "Gib offen zu, dass bei [KERN_ART] diesmal beim Portionieren oder der Zubereitung geschlampt wurde. Sag, dass das besser geht und lade auf ein neues Probieren ein.",
      sie: "Gib offen zu, dass bei [KERN_ART] diesmal beim Portionieren oder der Zubereitung ein Fehler unterlaufen ist. Sagen Sie, dass dies unserem Anspruch widerspricht und laden Sie zu einem neuen Versuch ein."
    },
    STANDARD_BETRIEB: {
      du: "Erkläre kurz und direkt, dass diese Portionierung unser fester, kalkulierter Standard für [KERN] ist, damit die Balance des Gerichts stimmt.",
      sie: "Erkläre kurz und direkt, dass diese Portionierung unser fester, kalkulierter Standard für [KERN] ist, damit die feine Balance des Gesamtegerichts gewahrt bleibt."
    }
  },
  B: { // Echter Fehler / Wartezeit
    STANDARD_BETRIEB: { // Bei B oft "Auslastung"
      du: "Gib zu, dass die Wartezeit auf [KERN_ART] zu lang war, weil die Küche in dem Moment geglüht hat. Bedanke dich für die Geduld.",
      sie: "Gib zu, dass die Wartezeit auf [KERN_ART] zu lang war, weil unsere Küche zu diesem Zeitpunkt unter Volllast lief. Bedanken Sie sich für die Geduld der Gäste."
    },
    FEHLER_KUECHE: {
      du: "Übernimm die volle Verantwortung dafür, dass [KERN_ART] misslungen oder falsch war. Kein Drumherumreden, sag einfach, dass wir da einen Fehler gemacht haben.",
      sie: "Übernehmen Sie die volle Verantwortung dafür, dass [KERN_ART] nicht korrekt war. Ohne Rechtfertigung, drücken Sie aus, dass hier ein Fehler im Ablauf vorlag."
    },
    WERT_HIGHLIGHT: {
      du: "Erkläre, dass [KERN_ART] frisch zubereitet wird und deshalb naturgemäß etwas Weile braucht, weil wir kein Fast-Food sind.",
      sie: "Erkläre, dass [KERN_ART] frisch zubereitet wird und ein guter Ablauf auf dem Grill oder in der Küche Zeit benötigt, da wir großen Wert auf Frische legen."
    }
  },
  A: { // Konzept / Struktur
    WERT_HIGHLIGHT: {
      du: "Erkläre den logischen, konzeptionellen Grund für [KERN] (z.B. warum es das Limit gibt). Biete als Option an, danach an die Bar oder an Stehtische zu wechseln.",
      sie: "Erkläre den logischen, konzeptionellen Grund für [KERN] (z.B. den organisatorischen Ablauf des Zeitfensters). Bieten Sie die Option an, den Aufenthalt an der Bar zu verlängern."
    },
    FEHLER_KUECHE: { du: "", sie: "" }, // Für Konzept-Kritik meist irrelevant
    STANDARD_BETRIEB: { du: "", sie: "" }
  }
}

// ─── PHASE 2: ENGINE FÜR DIE SWIPE-OPTIONEN ──────────────────────────────────
// Diese Funktion wird aufgerufen, sobald der Gastronom im UI eine Haltung klickt.
// Sie füttert Claude mit einem extrem fokussierten, floskelgünstigen Prompt.

export async function generateCoreOptions(
  analysis: Analysis,
  settings: Settings,
  reviewerName: string,
  gewaehlteHaltung: GastronomHaltung
): Promise<{ opt1: string; opt2: string; opt3: string }> {
  
  const { isDu, businessName } = resolveSettings(settings, reviewerName)
  const hauptkat = analysis.categories[0] || 'C'
  const nominativ = analysis.nominative[0] || 'dieser Punkt'
  const nominativArtikel = analysis.nominativeArtikel[0] || nominativ

  // Richtige Du/Sie-Instruktion aus der Matrix ziehen
  const anweisungTemplate = HALTUNG_PROMPTS[hauptkat]?.[gewaehlteHaltung]
  if (!anweisungTemplate) {
    throw new Error(`Keine Schablone für Kombination ${hauptkat} + ${gewaehlteHaltung} gefunden.`)
  }
  
  const spezifischeAnweisung = isDu ? anweisungTemplate.du : anweisungTemplate.sie
  const finaleAnweisung = spezifischeAnweisung
    .replace('[KERN_ART]', nominativArtikel)
    .replace('[KERN]', nominativ)

  const duSieRegel = isDu 
    ? 'Nutze konsequent die Du-Form (du, dir, dein, dich klein geschrieben). Spreche den Gast direkt an.' 
    : 'Nutze konsequent die Sie-Form (Sie, Ihnen, Ihr). Bleibe professionell und höflich, aber distanziert.'

  // Der hochfokussierte Prompt für Claude — Keine All-in-One Überlastung mehr
  const prompt = `Du bist die Text-Engine eines hocherfolgreichen Gastronomen. Deine Aufgabe ist es, den KERN-SATZ für eine Bewertungsantwort zu schreiben.
  
  Gegenstand der Kritik: "${nominativArtikel}" (Kategorie ${hauptkat})
  Deine strategische Ausrichtung für diesen Satz: ${finaleAnweisung}
  
  TONALITÄTS-REGELN:
  - Antworte absolut floskelfrei.
  - VERBOTENE WÖRTER: "entspricht nicht unserem anspruch", "nehmen wir sehr ernst", "Unannehmlichkeiten", "Bedauern", "Verständnis".
  - Schreibe so ehrlich und direkt, als würde der Chef dem Gast das abends an der Bar erklären.
  - ${duSieRegel}
  - Jeder Satz muss kurz und auf den Punkt sein (maximal 15 Wörter pro Satz).

  Generiere 3 völlig unterschiedliche, charakterstarke Varianten (z.B. Variante 1: sehr locker, Variante 2: extrem direkt, Variante 3: charmant/gastfreundlich).
  
  Gib AUSSCHLIESSLICH ein valides JSON-Objekt in diesem Format zurück:
  {
    "opt1": "Erste Textvariante...",
    "opt2": "Zweite Textvariante...",
    "opt3": "Dritte Textvariante..."
  }`

  // HIER erfolgt der API-Aufruf an Claude (Anthropic API)
  // const response = await claude.messages.create({ ... prompt ... })
  
  return JSON.parse("{/* Claude JSON Response */}")
}

// ─── PHASE 3: DER KLEVENE "KLEBER & GLÄTTER" ──────────────────────────────────
// Wenn der Gastronom seine Option gewählt hat, kleben wir die Fragmente (Begrüßung, 
// der ausgewählte Core-Satz, der v7-Abschluss und Gruß) zusammen und glätten es.

export async function finalizeAndSmoothResponse(
  settings: Settings,
  reviewerName: string,
  selectedCoreOption: string,
  analysis: Analysis
): Promise<string> {
  const { signature, isDu, firstNameClean } = resolveSettings(settings, reviewerName)
  
  // 1. Begrüßung (Aus deinem v7-Konzept)
  const begruessung = firstNameClean ? `Hallo ${firstNameClean},` : d(isDu, "Hallo,", "Guten Tag,")
  
  // 2. Brücke (Aus deinem v7-Konzept)
  const aberBruecke = analysis.categories[0] === 'C'
    ? d(isDu, "schade, dass wir dich diesmal nicht ganz überzeugen konnten.", "schade, dass wir Sie diesmal nicht ganz überzeugen konnten.")
    : d(isDu, "schade, dass bei deinem Besuch nicht alles rund gelaufen ist.", "schade, dass bei Ihrem Besuch nicht alles rund gelaufen ist.")

  // 3. Abschluss & Gruß (Aus deinem v7-Konzept)
  const gruss = d(isDu, `Viele Grüße, ${signature}`, `Mit besten Grüßen, ${signature}`)

  // Rohes Zusammenstecken der Blöcke im Code
  const roherText = `${begruessung} ${aberBruecke} ${selectedCoreOption} ${gruss}`

  // Claude fungiert jetzt NUR noch als smarter Klebstoff, der den Text flüssig macht,
  // ohne neue Floskeln oder Inhalte dazuzuerfinden.
  const smoothingPrompt = `Du bist ein High-End Text-Editor für Gastronomie-Betriebe.
  Hier ist ein Entwurf für eine Antwort auf eine Bewertung:
  "${roherText}"
  
  Deine einzige Aufgabe ist es, diesen Entwurf grammatikalisch zu glätten und die Übergänge flüssig zu machen (z.B. durch geschickte Bindewörter wie 'allerdings' oder 'deshalb').
  
  STRIKTE ENGINEREGELN:
  1. Verändere NIEMALS die inhaltliche Aussage des mittleren Satzes.
  2. Füge KEINE neuen Marketing-Floskeln oder Entschuldigungen hinzu.
  3. Beachte strikt die vorgegebene Form: ${isDu ? 'Duzen (du, dir klein)' : 'Siezen (Sie, Ihnen)'}.
  4. Gib als Antwort AUSSCHLIESSLICH den finalen, geglätteten Text aus, ohne Metatext.`

  // HIER API-Aufruf für das finale Glätten
  // const finalOutput = await claude.messages.create({ ... smoothingPrompt ... })
  
  return "Der finale, glatte, wunderschöne Text."
}
