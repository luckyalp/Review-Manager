import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Analysis {
  count: number
  points: string[]
  categories: string[]
  forceSummarize: boolean
  lobpunkte: string[]
  vorOrtErwaehnt: boolean
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

  return { businessName, salutation, contactEmail, signature, duSie, firstNameClean, langInstruction, context }
}

// ─── SHARED: FORMAT-REGELN (gelten immer) ────────────────────────────────────
// Dieser Block erscheint in JEDEM Prompt — er ist kurz und eindeutig.

const FORMAT_RULES = `ABSOLUTES VERBOT — GEDANKENSTRICHE: Verwende niemals "–", "—" oder langen Bindestrich. Ersetze durch Punkt oder Komma.
ABSOLUTES VERBOT — TAGESZEITEN: Niemals "Abend", "Morgen", "Mittag", "Nacht", "Fruehstueck". Stattdessen "Besuch", "Aufenthalt", "Zeit bei uns".
ABSOLUTES VERBOT — DOPPELPUNKT-LABEL: Kein "Zur Tischzeit:" oder aehnliche Ueberschriften. Durchgehende Saetze.
VERBOTENE WOERTER: "frustrierend", "intern adressiert", "intern nachgeschaerft", "massnahmen ergriffen", "entspricht nicht unserem anspruch", "nehmen wir sehr ernst", "gib uns eine chance".
UMLAUTE: Nutze ä, ö, ü, ß — niemals ae, oe, ue.
RESTAURANTPROFIL: Nutze fuer Beschreibungen ausschliesslich die Angaben aus dem Restaurantprofil. Leite nichts aus dem Restaurantnamen ab.
GRAMMATIK: Jeder Satz muss vollstaendig sein (Subjekt, Praedikat). Maximal zwei Kommas pro Satz — sonst aufteilen.`

// ─── KATEGORIE-BLÖCKE (A / B / C) ────────────────────────────────────────────
// Werden nur in Negative- und Mixed-Prompts eingesetzt, und nur wenn Analysis
// die jeweilige Kategorie erkannt hat.

const KATEGORIE_A = `KATEGORIE A — KONZEPT ODER STRUKTURELL FIX:
Gilt wenn die Kritik etwas betrifft, das durch die Art des Ladens oder eine feste Regel bedingt ist und sich grundsaetzlich nicht aendert (Tischzeit-Limit, Lautstaerke bei vollem Haus, Oeffnungszeiten, Zahlungsmethoden).

Aufbau:
1. Gefuehl validieren (siehe Schritt 1 unten)
2. Ehrlichen Grund nennen WARUM es so ist — als einziger kurzer Satz, nicht als Rechtfertigung. Das Wort "Konzept" ist erlaubt.
   TONFALL: Der Grund-Satz soll offen klingen, nicht wie eine Tuer-zu-Aussage. Nie "Das ist halt so bei uns." oder "So sind wir nun mal." als abschliessenden Satz.
   BEI AUSLASTUNGSABHAENGIGER KRITIK (laut, warm, eng — wenn viel los ist): "Kann sein, dass das fuer den einen oder anderen [laut/warm] wirkt, wenn viel los ist."
   BEI FESTER EIGENSCHAFT (Tischabstand, Raumkonzept): Als bewusste Konzept-Entscheidung benennen — Konzept-Wort + konkreter Nutzen in EINEM Satz.
   GRENZE ZU PUNKT 3: Der Grund-Satz erklaert NUR warum die Regel existiert. Er nennt KEINE Alternative und KEINE Option fuer den Gast (kein "Bar", "Stehtisch", "anrufen" hier) — das gehoert ausschliesslich in Punkt 3. Sonst verschmelzen Erklaerung und Abschluss zu einem einzigen Erklaerungsfluss ohne Bruch.
3. Abschluss: NEUER, eigenstaendiger Gedanke (nicht Fortsetzung von Punkt 2). Leite aus dem genannten Grund die konkrete Handlungsoption fuer den naechsten Besuch ab. Direkte Anrede, nie "man" oder "wer". Keine Wiederholung des Gefuehls aus Schritt 1.
   WENN das Profil sowohl eine Bar/Steh-Option als auch reservierbare Tische kennt UND die Bewertung sich auf die Bar-Verweisung/Tischregel bezieht: beide Optionen nennen (spontan vorbeikommen fuers Getraenk, reservieren fuers Essen — die genaue Art der Reservierung NUR so beschreiben, wie es im Profil steht, kein "anrufen" annehmen wenn das Profil nichts dazu sagt) — nicht nur eine davon.
   SONST: eine einzige passende Option aus dem Profil.
   WENN kein Profil-Tipp passt und auslastungsabhaengig: "Zu ruhigeren Zeiten ist's da meist entspannter."
KEIN oeffentliches Versprechen, etwas strukturell zu aendern.`

const KATEGORIE_B = `KATEGORIE B — ECHTER FEHLER, EINZELFALL:
Gilt wenn die Kritik einen objektiven Fehler beschreibt (falsches Gericht, lange Wartezeit ohne Grund, unfreundliches Personal) der NICHT durch Konzept bedingt ist.

Aufbau:
1. Gefuehl validieren (siehe Schritt 1 unten)
2. Verantwortung uebernehmen, OHNE zu rechtfertigen. Keine Auslastungs-Begruendung wenn die Bewertung das Gegenteil beschreibt.
3. Abschluss:
   - Hat der Gast das Problem VOR ORT geloest? Nur kurze Anerkennung, kein weiterer Ausblick.
   - Problem WAEHREND Besuch moegich zu melden? Geste: "Wink uns kurz, dann kuemmern wir uns gleich."
   - Problem erst spaeter bemerkt? Einladung ohne Schuldzuweisung: "Komm gerne nochmal vorbei, das geht besser."
VERBOTEN: "intern nachgeschaerft", "dem Team mitgeteilt", "Massnahmen", interne Ablaeufe erklaeren.`

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

function buildPositivePrompt(
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any
): string {
  const { signature, duSie, firstNameClean, langInstruction, context } = resolveSettings(settings, reviewerName)

  const systemPrompt = `Erstelle eine ehrliche, persoenliche Antwort auf eine positive Google-Bewertung fuer ein Restaurant.
Schreibe wie ein aufmerksamer Gastronom — nicht wie Kundenservice, PR-Agentur oder KI.

${FORMAT_RULES}

VERBOTENE POSITIVE OPENER (direkt nach der Begruessung):
"Das freut uns sehr", "Freut uns sehr", "Danke fuer die tollen Worte", "Wir hoffen dich bald wieder begruessen zu duerfen", "Vielen Dank fuer Ihre/deine Bewertung", "Vielen Dank fuer Ihr/dein Feedback", "Das zeigt uns, dass wir auf dem richtigen Weg sind".

REGEL — DIREKTE REAKTION: Starte direkt mit einer echten Reaktion auf das was der Gast konkret gelobt hat. Kein generisches Dankeschoen. Wenn ein bestimmtes Gericht, ein Mitarbeiter oder eine Atmosphaere gelobt wird: Geh spezifisch darauf ein.

LAENGE: 1-2 Saetze bei kurzem Lob, maximal 3 Saetze bei ausfuehrlichem Lob. Nicht uebertreiben.

KEIN OEFFENTLICHES STRUKTURVERSPRECHEN: Versprich nie etwas Strukturelles zu aendern.`

  const userMessage = `${langInstruction} Anredeform: ${duSie}

KONTEXT (nur sinngemaess einfliessen lassen, nicht woertlich uebernehmen):
${context}

Bewertung von ${firstNameClean || 'einem Gast'} (${stars} Sterne):
"${reviewText}"

Schreibe EINE freie, persoenliche Antwort.
${firstNameClean ? `Beginne mit "Hallo ${firstNameClean},"` : 'Kein Name bekannt — ohne persoenliche Anrede beginnen.'}
Abschluss: Waehle passend "Viele Gruesse, ${signature}" oder "Herzliche Gruesse, ${signature}" oder "Beste Gruesse, ${signature}"

AUSGABE — NUR dieses JSON:
{"label":"Frei (Test)","text":"..."}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── PROMPT: MIXED (3 Sterne) ─────────────────────────────────────────────────

function buildMixedPrompt(
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any,
  analysis?: Analysis
): string {
  const { signature, duSie, firstNameClean, langInstruction, context } = resolveSettings(settings, reviewerName)

  // Nur die tatsaechlich erkannten Kategorien einbinden
  const cats = analysis?.categories?.length ? Array.from(new Set(analysis.categories)) : ['A', 'B', 'C']
  const kategorieBloecke = [
    cats.includes('A') ? KATEGORIE_A : '',
    cats.includes('B') ? KATEGORIE_B : '',
    cats.includes('C') ? KATEGORIE_C : '',
  ].filter(Boolean).join('\n\n')

  const systemPrompt = `Erstelle eine ehrliche, persoenliche Antwort auf eine gemischte Google-Bewertung (3 Sterne) fuer ein Restaurant.
Schreibe wie ein aufmerksamer Gastronom — nicht wie Kundenservice oder KI.

${FORMAT_RULES}

VERBOTENE OPENER (nach der Begruessung): "Vielen Dank fuer Ihre/deine Bewertung", "Danke fuer das Feedback", "Das freut uns sehr".

SCHRITT 1 — GEFUEHL VALIDIEREN (erster Satz):
Formuliere einen einzigen freien Satz der zeigt dass der Gast gehoert wurde.
Struktur: "Dass + [Gefuehl/Eindruck] + [Wahrnehmungs-Verb], finden wir schade / bedauern wir."
Beispiele (Ton uebernehmen, nicht woertlich kopieren):
- "Dass dein Besuch diesen Eindruck hinterlassen hat, finden wir schade."
- "Schade, dass es nicht ganz gestimmt hat."
VERBOTEN als Validierungsverben: "verstehen", "nachvollziehen", "nachempfinden" — diese implizieren Schuld.
LOB ZUERST: Hat der Gast trotz Kritik etwas Positives erwaehnt? Das Lob ZUERST aufgreifen, dann Kritik.

SCHRITT 2 — EINORDNUNG:
Geh auf die Kritik ein gemaess den Kategorie-Bloecken unten. Bei mehreren Kritikpunkten: EINEN zusammenfassenden Satz ("da scheint bei uns einiges nicht rundgelaufen zu sein"), keine Aufzaehlung.

${kategorieBloecke}

ABSCHLUSS (letzter Satz vor Signatur): Vorwaertsgerichteter Satz — was wird der Gast beim naechsten Mal anders erleben? Nicht generisch ("komm gerne wieder"), sondern konkret zu DIESER Bewertung passend. Beispiele: "Lass den naechsten Besuch fuer sich sprechen." / "Lass uns beim naechsten Mal den vierten Stern gemeinsam holen."

KEIN KONTAKTANGEBOT, KEINE E-MAIL in dieser Antwort.
KEIN oeffentliches Strukturversprechen.
SPRECHSTIL: Vermeide literarische Konstruktionen ("schlichtweg", "voellig", "kein einziges X"). Wuerde ein Gastronom das im Gespraech so sagen?`

  const userMessage = `${langInstruction} Anredeform: ${duSie}

KONTEXT (nur sinngemaess einfliessen lassen, nicht woertlich uebernehmen):
${context}

Bewertung von ${firstNameClean || 'einem Gast'} (${stars} Sterne):
"${reviewText}"

${analysis ? `FAKTEN AUS VORSTUFE (nur Stuetze — Original hat immer Vorrang):
${analysis.lobpunkte.length > 0 ? `- Positiv erwaehnt: ${analysis.lobpunkte.join(', ')}` : ''}
${analysis.points.length > 0 ? `- Kritisiert: ${analysis.points.join(', ')}` : ''}
- Vor Ort angesprochen: ${analysis.vorOrtErwaehnt ? 'ja' : 'nicht erkennbar'}` : ''}
${analysis?.forceSummarize ? `\nZUSAMMENFASSUNGS-PFLICHT: ${analysis.count} Kritikpunkte erkannt — alle in EINEM zusammenfassenden Satz behandeln, keine Aufzaehlung.` : ''}

Schreibe EINE freie, persoenliche Antwort (2-3 Saetze).
${firstNameClean ? `Beginne mit "Hallo ${firstNameClean},"` : 'Kein Name bekannt — ohne persoenliche Anrede beginnen.'}
Abschluss: Waehle passend "Viele Gruesse, ${signature}" oder "Herzliche Gruesse, ${signature}" oder "Beste Gruesse, ${signature}"

AUSGABE — NUR dieses JSON:
{"label":"Frei (Test)","text":"..."}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── PROMPT: NEGATIV (1–2 Sterne) ────────────────────────────────────────────

function buildNegativePrompt(
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any,
  analysis?: Analysis
): string {
  const { signature, duSie, firstNameClean, langInstruction, context, contactEmail } = resolveSettings(settings, reviewerName)

  const cats = analysis?.categories?.length ? Array.from(new Set(analysis.categories)) : ['A', 'B', 'C']
  const kategorieBloecke = [
    cats.includes('A') ? KATEGORIE_A : '',
    cats.includes('B') ? KATEGORIE_B : '',
    cats.includes('C') ? KATEGORIE_C : '',
  ].filter(Boolean).join('\n\n')

  const systemPrompt = `Erstelle eine ehrliche, persoenliche Antwort auf eine negative Google-Bewertung (1-2 Sterne) fuer ein Restaurant.
Schreibe wie ein aufmerksamer Gastronom — nicht wie Kundenservice, PR-Agentur oder KI.

${FORMAT_RULES}

VERBOTENE OPENER: "Vielen Dank fuer Ihre/deine Bewertung", "Danke fuer das Feedback", "Das tut uns sehr leid" als Standard-Einstieg.
VERBOTEN: "nicht das was wir uns vorstellen", "kein erlebnis das so bleiben soll", "entspricht nicht unserem anspruch", "nicht das wofuer wir stehen".
VERBOTEN: Ueberfluessige Einschraenkungen nach einer klaren Aussage: "auch wenn es nicht schoen ist", "auch wenn das keine Entschuldigung ist". Die Aussage endet. Punkt.

SCHRITT 1 — GEFUEHL VALIDIEREN (erster Satz nach Begruessung):
Formuliere EINEN freien Satz der zeigt dass der Gast gehoert wurde.
Struktur: "Dass + [Gefuehl/Eindruck/Wahrnehmung] + [Wahrnehmungs-Verb], finden wir schade / bedauern wir."
WENN die Kritik an eine BEDINGUNG gekoppelt ist (z.B. "wenn man nur etwas trinken will, fuehlt man sich unerwuenscht"): Bedingung und Gefuehl gehoeren in ZWEI separate Teile, nicht in einen verschachtelten Hauptsatz. Bedingung als eigener Nebensatz VOR dem Gefuehl, z.B. "Wenn du nur etwas trinken wolltest, hast du dich direkt unerwuenscht gefuehlt, das finden wir schade." NIEMALS die Bedingung als knappen Einschub in den Hauptsatz quetschen (FALSCH: "Dass du dich mit einem Getraenk nicht willkommen gefuehlt hast" — klingt nach niemandem, der so spricht).
Drei Regeln:
1. Validiere das GEFUEHL IM MOMENT — nicht die Schlussfolgerung. Bei "ich fuehlte mich nicht willkommen": validiere die Verwirrung, den unangenehmen Moment — nicht die Schlussfolgerung selbst.
2. Subjekt ist der Gast / der Besuch — NICHT die Ursache. FALSCH: "Die Lautstaerke hat deinen Besuch gestoert." RICHTIG: "Schade, dass dich die Lautstaerke so gestoert hat."
3. VERBOTEN als Validierungsverben: "verstehen", "nachvollziehen", "nachempfinden" — diese implizieren Zustimmung oder Schuld.
Variiere den Satz jedes Mal. Nie zweimal dieselbe Formulierung.

SCHRITT 2 — EINORDNUNG gemaess Kategorie-Bloecken:
${kategorieBloecke}

BEI MEHREREN KATEGORIEN: Kat-B-Fehler in EINEM zusammenfassenden Satz ("da scheint bei uns einiges nicht rundgelaufen zu sein") — keine Aufzaehlung. Kat-A und Kat-B mit "und" verbinden, nicht mit "aber".

ABSCHLUSS: Kein Kontaktangebot ausser die Bewertung ist ein echter Kat-B-Fehler mit offenem Gespraechsbedarf. Kein oeffentliches Strukturversprechen. Kein betteln um eine zweite Chance.

SPRECHSTIL: Klingt die Antwort wie ein echter Gastronom im Gespraech, oder wie ein geschriebener Text? Pruefe jeden Satz.
KONSISTENTE PERSPEKTIVE: Entweder konsequent "ich" (einzelne Person) oder "wir" (Team) — passend zur Signatur "${signature}".`

  const userMessage = `${langInstruction} Anredeform: ${duSie}

KONTEXT (nur sinngemaess einfliessen lassen, nicht woertlich uebernehmen):
${context}
${contactEmail ? `Kontakt-E-Mail (nur erwaehnen wenn Kontaktangebot fuer DIESE Bewertung wirklich sinnvoll ist): ${contactEmail}` : ''}

Bewertung von ${firstNameClean || 'einem Gast'} (${stars} Sterne):
"${reviewText}"

${analysis ? `FAKTEN AUS VORSTUFE (nur Stuetze — Original hat immer Vorrang):
${analysis.lobpunkte.length > 0 ? `- Positiv erwaehnt: ${analysis.lobpunkte.join(', ')}` : ''}
${analysis.points.length > 0 ? `- Kritisiert: ${analysis.points.join(', ')}` : ''}
- Vor Ort angesprochen: ${analysis.vorOrtErwaehnt ? 'ja' : 'nicht erkennbar'}` : ''}
${analysis && analysis.points.length > 1 ? `\nAUFGABENTEILUNG BEI MEHREREN KRITIKPUNKTEN (${analysis.points.length} erkannt): Der Validierungssatz (Schritt 1) beschreibt NUR das Gesamtgefuehl/den Gesamteindruck des Besuchs (z.B. "kein runder Abschluss", "ein unrunder Verlauf") und benennt dabei KEINEN der einzelnen konkreten Vorfaelle. Die konkreten Vorfaelle (${analysis.points.join(', ')}) werden ausschliesslich in Schritt 2 behandelt, jeder genau einmal. So wird kein Vorfall doppelt genannt (einmal in der Validierung, einmal in der Einordnung).` : ''}
${analysis?.forceSummarize ? `\nZUSAMMENFASSUNGS-PFLICHT: ${analysis.count} Kritikpunkte erkannt — alle in EINEM zusammenfassenden Satz behandeln. VERBOTEN: Mehr als einen konkreten Punkt namentlich nennen.` : ''}

Schreibe EINE freie, persoenliche Antwort (2-4 Saetze, passend zum Anlass).
${firstNameClean ? `Beginne mit "Hallo ${firstNameClean},"` : 'Kein Name bekannt — ohne persoenliche Anrede beginnen.'}
Abschluss: Waehle passend "Viele Gruesse, ${signature}" oder "Herzliche Gruesse, ${signature}" oder "Beste Gruesse, ${signature}"

AUSGABE — NUR dieses JSON:
{"label":"Frei (Test)","text":"..."}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── PROMPT: EMPTY POSITIVE (4-5 Sterne, kein oder kaum Text) ─────────────────

function buildEmptyPositivePrompt(
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any
): string {
  const { signature, duSie, firstNameClean, langInstruction, context } = resolveSettings(settings, reviewerName)
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  const hasMeaningfulText = reviewText.trim().length >= 3

  const reviewBlock = !hasMeaningfulText
    ? `BEWERTUNG: ${stars} Sterne — kein Text.`
    : `BEWERTUNG: ${stars} Sterne. Der Gast hat geschrieben: "${reviewText.trim()}"
Das ist sehr kurz (${wordCount} ${wordCount === 1 ? 'Wort' : 'Woerter'}) — behaupte NIEMALS "kein Text".
Wenn ein Thema erkennbar ist: kurz darauf eingehen. Wenn nicht: positive Stimmung kurz anerkennen.`

  const systemPrompt = `Erstelle eine kurze, herzliche Antwort auf eine positive Bewertung ohne langen Text.

${FORMAT_RULES}

VERBOTEN: "Vielen Dank fuer Ihre Bewertung", "Das freut uns sehr", "Wir heissen Sie willkommen".
Schreibe wie gesprochen, nicht wie formuliert. Max. 2 Saetze. Keine Floskeln.
Beispiele (Ton uebernehmen, nicht woertlich kopieren):
- "Danke dir :) Schoen, dass du bei uns warst."
- "5 Sterne nehmen wir natuerlich gern. Danke dir."
- "Freut uns, dass du einen schoenen Besuch hattest. Bis bald :)"`

  const userMessage = `${langInstruction} Anredeform: ${duSie}

KONTEXT:
${context}

${reviewBlock}

Schreibe EINE kurze, herzliche Antwort.
${firstNameClean ? `Beginne mit einer Begruessung inkl. Name: "Hallo ${firstNameClean}," oder "Hi ${firstNameClean},"` : 'Kein Name — ohne persoenliche Anrede.'}
Endet mit: ${signature}

AUSGABE — NUR dieses JSON:
{"label":"Frei (Test)","text":"..."}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── PROMPT: EMPTY NEGATIVE (1-2 Sterne, kein oder kaum Text) ─────────────────

function buildEmptyNegativePrompt(
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any
): string {
  const { signature, duSie, firstNameClean, langInstruction, context, contactEmail } = resolveSettings(settings, reviewerName)
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  const hasMeaningfulText = reviewText.trim().length >= 3

  const reviewBlock = !hasMeaningfulText
    ? `BEWERTUNG: ${stars} Sterne — kein Text.`
    : `BEWERTUNG: ${stars} Sterne. Der Gast hat geschrieben: "${reviewText.trim()}"
Das ist sehr kurz (${wordCount} ${wordCount === 1 ? 'Wort' : 'Woerter'}) — behaupte NIEMALS "kein Text".
Wenn ein Thema erkennbar ist: kurz darauf eingehen. Wenn nicht: Stimmung anerkennen, freundlich nach mehr fragen.`

  const systemPrompt = `Erstelle eine kurze, ehrliche Antwort auf eine negative Bewertung ohne langen Text.

${FORMAT_RULES}

VERBOTEN: "Vielen Dank fuer Ihre Bewertung", "Das tut uns leid" als Standard-Einstieg, leere Entschuldigungen.
Anerkennen + Einladung zur direkten Kontaktaufnahme. Kein Druck.
Max. 3 Saetze. Schreibe wie gesprochen.
Beispiele (Ton uebernehmen, nicht woertlich kopieren):
- "Da scheint ja einiges schiefgelaufen zu sein. Ohne mehr zu wissen, koennen wir's schwer einordnen."
- "Schade, dass du uns so erlebt hast. Meld dich gern direkt, wenn du magst."`

  const userMessage = `${langInstruction} Anredeform: ${duSie}

KONTEXT:
${context}
${contactEmail ? `Kontakt-E-Mail: ${contactEmail}` : ''}

${reviewBlock}

Schreibe EINE ehrliche Antwort.
${firstNameClean ? `Beginne mit "Hallo ${firstNameClean},"` : 'Kein Name — ohne persoenliche Anrede.'}
Endet mit: ${signature}

AUSGABE — NUR dieses JSON:
{"label":"Frei (Test)","text":"..."}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
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
    case 'CONTENT_NEGATIVE': return buildNegativePrompt(reviewText, stars, reviewerName, settings, analysis)
    default: return buildNegativePrompt(reviewText, stars, reviewerName, settings, analysis)
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
  { key: 'apology_in_v1',      test: (t, _sig, idx) => idx === 0 && /tut\s+(mir|uns)\s+(wirklich\s+|aufrichtig\s+)?leid/i.test(t) },
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
    const raw = await callClaude(prompt, undefined, 'claude-haiku-4-5-20251001', 0)
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
{"points":["Punkt1"],"categories":["B"],"lobpunkte":["Lob1"],"vor_ort_erwaehnt":false}

Regeln:
1. "points": Konkrete Kritikpunkte, max. 3 Woerter pro Punkt. Kein Lob.
2. "categories": Pro Kritikpunkt in gleicher Reihenfolge ein Buchstabe:
   A = Konzept/strukturell (Hausregeln, Lautstaerke, Tischvergabe, Oeffnungszeiten)
   B = Echter Fehler (Wartezeiten, falsche Bestellung, unfreundlicher Service)
   C = Geschmack/Wahrnehmung (zu scharf, zu wenig Portion, nicht gemuetlich)
3. "lobpunkte": Positive Erwaehnung, max. 3-4 Woerter. Leer wenn kein Lob.
4. "vor_ort_erwaehnt": true nur wenn unmissverstaendlich aus Text hervorgeht dass Gast etwas dem Personal gesagt hat.`

  try {
    const result = await callClaude(`Bewertung:\n"${reviewText}"`, systemPrompt, 'claude-haiku-4-5-20251001', 0)
    const parsed = parseJson(result)
    const points = parsed.points || []
    return {
      count: points.length,
      points,
      categories: parsed.categories || [],
      forceSummarize: points.length >= 3,
      lobpunkte: parsed.lobpunkte || [],
      vorOrtErwaehnt: parsed.vor_ort_erwaehnt === true,
    }
  } catch {
    return { count: 0, points: [], categories: [], forceSummarize: false, lobpunkte: [], vorOrtErwaehnt: false }
  }
}

// ─── CONTEXT CHECK ────────────────────────────────────────────────────────────

async function checkContext(reviewText: string, description: string): Promise<{ ok: boolean; missing?: string }> {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 6) return { ok: true }

  const systemPrompt = `Qualitaetspruefer fuer Restaurant-Antworten.
Entscheide ob das Restaurantprofil genueg Informationen enthaelt um sicher zu antworten.

Antworte NUR mit:
OK
MISSING: [kurze Beschreibung was fehlt, max. 1 Satz auf Deutsch]

MISSING ist korrekt NUR wenn: Bewertung kritisiert eine KONKRETE HAUSREGEL und Profil enthaelt dazu keine Erklaerung.
In ALLEN anderen Faellen (Service, Essen, Atmosphaere, Verhalten): OK.`

  try {
    const result = await callClaude(
      `RESTAURANTPROFIL:\n${description || '(keine Beschreibung)'}\n\nBEWERTUNG:\n"${reviewText}"\n\nAusreichend?`,
      systemPrompt, 'claude-haiku-4-5-20251001', 0
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

// ─── HAUPT-VARIANT GENERIEREN (mit Qualitaetscheck + max. 2 Regenerierungen) ──

async function generateVariant(
  mode: string,
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any,
  analysis: Analysis,
  signature: string
): Promise<{ label: string; text: string; isFreeTest: true } | null> {
  const MAX_ATTEMPTS = 2

  const promptStr = buildPrompt(mode, reviewText, stars, reviewerName, settings, analysis)
  let promptParsed: { _system?: string; _user?: string } | null = null
  try {
    const p = JSON.parse(promptStr)
    if (p._system && p._user) promptParsed = p
  } catch { /* ignore */ }

  let userMsg = promptParsed?._user || promptStr
  let lastResult: { label: string; text: string } | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = promptParsed
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
    console.log('v5 mode:', mode, '| analysis:', analysis)

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
    console.error('generate-replies-v5 FEHLER:', errMsg)
    return res.status(500).json({ error: 'Serverfehler', details: errMsg })
  }
}
