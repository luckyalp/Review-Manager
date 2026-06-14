import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

function classify(rating: number, reviewText: string) {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  const hasText = wordCount >= 6
  if (!hasText && rating >= 4) return 'EMPTY_POSITIVE'
  if (!hasText && rating <= 2) return 'EMPTY_NEGATIVE'
  if (rating >= 4) return 'CONTENT_POSITIVE'
  if (rating === 3) return 'CONTENT_MIXED'
  return 'CONTENT_NEGATIVE'
}

function buildPrompt(reviewText: string, rating: number, reviewerName: string, settings: any, reviewAnalysis?: string): string {
  const {
    businessName = 'das Restaurant',
    cuisineType = '',
    uniqueSellingPoints = '',
    responseSignature = '',
    salutation = 'Sie',
    contactEmail = '',
    description = '',
    restaurantType = '',
    priceRange = '',
    responseLanguage = 'Deutsch',
    restaurantAtmosphere = '',
  } = settings || {}

  // V1 duzt immer, V2 siezt immer, V3 folgt den Settings
  const duSieAnrede = salutation === 'Du' ? 'Du/Dein (Duzen)' : 'Sie/Ihr (Siezen)'
  const anredeHinweis = salutation === 'Du'
    ? 'Nutze konsequent die Du-Form (du, dein, dir). Schreibe "dir" und "dein" klein.'
    : 'Nutze konsequent die Sie-Form (Sie, Ihr, Ihnen). Schreibe "Sie" und "Ihr" immer groß.'
  const signature = responseSignature || `Das Team von ${businessName}`
  const mode = classify(rating, reviewText)
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''

  const langInstruction =
    responseLanguage === 'Sprache des Bewerters'
      ? 'Antworte in der Sprache der Bewertung. Erkenne sie automatisch.'
      : responseLanguage === 'Englisch'
      ? 'Respond in English only.'
      : responseLanguage === 'Deutsch und Englisch'
      ? 'Antworte auf Deutsch und fuege direkt danach eine englische Uebersetzung in Klammern hinzu.'
      : 'Antworte auf Deutsch.'

  // Ersten Buchstaben gross, Rest klein — verhindert HEIKE-in-Caps-Bug
  const firstNameCapitalized = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  const begruessungV2 = salutation === 'Du'
    ? `Hallo ${firstNameCapitalized},`
    : `Hallo ${firstNameCapitalized},`

  const nameRule = firstNameCapitalized
    ? `PERSONALISIERUNG UND BEGRUESSUNGS-PFLICHT:
Alle drei Varianten MUESSEN mit einer Begruessung inkl. Name starten.
- DIREKT & EHRLICH: beginnt mit "Hi ${firstNameCapitalized}," oder "Hey ${firstNameCapitalized},"
- RUHIG & PROFESSIONELL: beginnt mit "Hallo ${firstNameCapitalized},"
- FOKUS AUF KLAERUNG: beginnt mit "Hi ${firstNameCapitalized}," oder "Hallo ${firstNameCapitalized},"
Schreibe den Namen IMMER genau so: ${firstNameCapitalized} — nie in Grossbuchstaben.`
    : `PERSONALISIERUNG UND BEGRUESSUNGS-PFLICHT:
Kein Name bekannt. Alle drei Varianten starten trotzdem mit einer Begruessung:
- DIREKT & EHRLICH: "Hi," oder "Hey,"
- RUHIG & PROFESSIONELL: "Hallo,"
- FOKUS AUF KLAERUNG: "Hi," oder "Hallo,"`

  const context = [
    `Restaurant: ${businessName}`,
    description          && `Beschreibung: ${description}`,
    restaurantType       && `Typ: ${restaurantType}`,
    cuisineType          && `Kueche: ${cuisineType}`,
    priceRange           && `Preisklasse: ${priceRange}`,
    restaurantAtmosphere && `Atmosphaere: ${restaurantAtmosphere}`,
    uniqueSellingPoints  && `Besonderheiten: ${uniqueSellingPoints}`,
    contactEmail         && `Kontakt-E-Mail: ${contactEmail}`,
  ].filter(Boolean).join('\n')

  const contactLine = contactEmail
    ? `Kontaktkanal fuer Variante 3: ${contactEmail}`
    : 'Kein Kontaktkanal hinterlegt — Variante 3 ohne E-Mail-Hinweis'

  // ─── EMPTY POSITIVE ────────────────────────────────────────────────────────
  if (mode === 'EMPTY_POSITIVE') {
    return `Du bist eine Hospitality Response Engine fuer "${businessName}".
${langInstruction}

KONTEXT:
${context}

${nameRule}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 kurze, herzliche Antworten. Max. 2 Saetze. Keine Floskeln. Keine Dankesformeln.
Schreibe wie gesprochen, nicht wie formuliert. Direkt beginnen.
Alle drei enden mit: ${signature}

BEISPIELE (genau dieser Ton):
- "Danke dir :) Schoen, dass du bei uns warst."
- "Freut uns, dass du einen schoenen Besuch hattest. Bis bald :)"
- "5 Sterne nehmen wir natuerlich gern. Danke dir."

ABSOLUT VERBOTEN:
- "Vielen Dank fuer Ihre/deine Bewertung"
- "Wir freuen uns ueber Ihr/dein Feedback"
- "Das freut uns sehr"
- "Wir heissen Sie jederzeit wieder herzlich willkommen"
- Jede Form von standardisierter Dankesformel
- Gedankenstriche (weder "—" noch " - ") — nutze Punkt oder Komma stattdessen.

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Herzlich","text":"..."},"variant2":{"label":"Persoenlich","text":"..."},"variant3":{"label":"Kurz & warm","text":"..."}}`
  }

  // ─── EMPTY NEGATIVE ────────────────────────────────────────────────────────
  if (mode === 'EMPTY_NEGATIVE') {
    return `Du bist eine Hospitality Response Engine fuer "${businessName}".
${langInstruction}

KONTEXT:
${context}

${nameRule}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 Antworten. Anerkennen + Einladung zur direkten Kontaktaufnahme. Kein Druck.
${contactLine}
Max. 3 Saetze. Schreibe wie gesprochen, nicht wie formuliert.
Nie mit Dankesformel beginnen. Keine leeren Entschuldigungen.
Alle drei enden mit: ${signature}

BEISPIELE (genau dieser Ton — beilaeufig, nicht komponiert):
- "Da scheint ja einiges schiefgelaufen zu sein. Ohne mehr zu wissen, koennen wir's schwer einordnen."
- "So ganz ohne Kontext ist das schwer. Wenn du magst, schreib uns kurz."
- "Schade, dass du uns so erlebt hast. Meld dich gern direkt, wenn du magst."

ABSOLUT VERBOTEN:
- "Vielen Dank fuer Ihre/deine Bewertung"
- "Das tut uns sehr leid"
- "Wir bitten um Verstaendnis"
- "Wir nehmen Ihr/dein Feedback ernst"
- Gedankenstriche (weder "—" noch " - ") — nutze Punkt oder Komma stattdessen.

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Direkt & Ehrlich","text":"..."},"variant2":{"label":"Ruhig & Professionell","text":"..."},"variant3":{"label":"Fokus auf Klaerung","text":"..."}}`
  }

  // ─── CONTENT MODI (POSITIVE / MIXED / NEGATIVE) ────────────────────────────

  const alreadyHandled = (reviewText.toLowerCase().includes('massnahmen') ||
    reviewText.toLowerCase().includes('reagiert') ||
    reviewText.toLowerCase().includes('versichert') ||
    reviewText.toLowerCase().includes('aufgenommen'))
    ? `WICHTIG: Der Gast erwaehnt, dass das Team bereits vor Ort reagiert hat.
Anerkenne diese Reaktion kurz — aber mache klar: sie hebt den Schrecken oder Vertrauensverlust nicht auf.
Nicht so tun als waere noch nichts passiert.`
    : ''

  // System-Prompt: Original Google AI Studio Instructions — kurz und sauber
  const systemPrompt = `Erstelle natuerliche, menschliche und professionelle Antworten auf Google-Bewertungen.
Die Antworten sollen nicht wie PR-Texte, Agenturtexte oder KI-Texte wirken.
Keine uebertriebene Freundlichkeit, keine Rechtfertigungen, keine Standardfloskeln.

Grundregeln:
Beschwerden nicht aufzaehlen oder wiederholen.
Kritik nicht spiegeln.
Keine Ursachen erfinden.
Keine internen Ablaeufe erklaeren.
Keine leeren Floskeln verwenden.
Kurz und natuerlich schreiben.
Eher wie ein Gastronom als wie eine Pressestelle.
Nutze fuer alle Beschreibungen (Typ, Atmosphaere, Konzept) ausschliesslich die Angaben aus dem Restaurantprofil. Leite niemals Informationen aus dem Restaurantnamen ab.
Niemals diese Phrasen verwenden: "nehmen wir sehr ernst", "intern adressiert", "intern nachgeschaerft", "Massnahmen ergriffen", "entspricht nicht unserem Anspruch", "nicht das wofuer wir stehen wollen", "nicht das was wir uns vorstellen".
Bei positiven Bewertungen niemals: "Das freut uns sehr/riesig", "Danke fuer die tollen Worte", "zeigt uns dass wir auf dem richtigen Weg sind", "Wir hoffen dich bald wieder begruessen zu duerfen", "Vielen Dank fuer deine Bewertung/dein Feedback".
Starte bei Lob direkt mit einer echten Reaktion — nie mit einem generischen Dankeschoen.

STRENGES FORMATIERUNGS-VERBOT (MENSCHLICHER SCHREIBSTIL):
KEINE GEDANKENSTRICHE: Nutze UNTER KEINEN UMSTAENDEN das Zeichen "—" oder lange Bindestriche zur Satzabgrenzung oder fuer Einschuebe, in KEINER der drei Varianten. Nutze STATTDESSEN immer einen Punkt oder ein Komma, um Saetze zu trennen oder Zusaetze einzufuegen.

VERBOT VON TAGESZEIT-BEZUEGEN: STRENG VERBOTEN: Verwende NIEMALS Woerter wie "Abend", "Abendessen", "Gruppenabend", "Nacht", "Morgen", "Mittag", "Mittagessen", "Fruehstueck" oder andere Tageszeit-Bezuege, auch wenn die Bewertung selbst eine Tageszeit nennt. Nutze IMMER neutrale Begriffe wie "Besuch", "Aufenthalt", "Zeit bei uns", "Besuch bei uns", "Erlebnis" oder "Termin bei uns".
ALLE VARIANTEN MUESSEN DIESE REGEL EINHALTEN. SCHREIBE NIEMALS "ABEND", "MORGEN" ODER "MITTAG".


Wenn die KI eine logische Ursache fuer eine Situation erklaert (z.B. hohe Auslastung, volles Haus, lebhafte Atmosphaere), darf sie danach NIEMALS so klingen als haette das Restaurant ein ungeloestes Problem oder muesste Besserung geloben.
VERBOTEN: "Das ist etwas, dem wir mehr Aufmerksamkeit widmen muessen" oder "Wir haben das auf dem Schirm" (wenn es sich um eine normale Gegebenheit handelt).
ERLAUBT: Die Situation als Gegebenheit stehen lassen und loesungsorientiert nach vorne blicken (z.B. einen anderen Tisch anbieten). Die KI waehlt EINE klare Linie: Entweder wir stehen zur lebhaften Atmosphaere eines vollen Hauses, ODER wir bieten eine diskrete Loesung an. Niemals beides vermischen.
Vermeide die inflationaere Nutzung von "Es tut mir leid" oder "Wir entschuldigen uns", besonders wenn es um subjektiven Geschmack, Preise oder Hausregeln geht. Das Restaurant knickt nicht ein.
Nutze stattdessen diese souveraenen Alternativen je nach Variante:
- Bei DIREKT & EHRLICH: Nutze "Schade, dass..." oder "Es ist aergerlich, wenn..."
  Erlaubt: "Kann ich gut nachvollziehen, wenn das bei dir nicht so angekommen ist, wie's sollte."
  Verboten: "Es tut uns leid, dass es nicht geschmeckt hat."
  Alternativ erlaubt: "Ich kann total nachempfinden, dass sich das im Moment nach [Frust/Enttaeuschung/...] angefuehlt haben muss." (passendes Gefuehl statt der Beispielwoerter einsetzen, nicht dem Gast eine Emotion unterstellen sondern aus eigener Perspektive Verstaendnis zeigen)
- Bei RUHIG & PROFESSIONELL: Nutze "Letztendlich war's nicht in Ordnung." oder "So oder so hat's nicht gepasst."
  Alternativ erlaubt: "Ich kann mir gut vorstellen, dass du dir den Besuch bei uns ganz anders vorgestellt hast."
- Bei FOKUS AUF KLAERUNG: Komplett ohne Entschuldigung einsteigen. Direkt auf die Loesung gehen.
  Erlaubt: "Klingt, als haette der Besuch bei euch nicht den Eindruck hinterlassen, den wir uns wuenschen."

ANTWORTSTRUKTUR — 3 SLOTS + ABSCHLUSS:

Slot 1 - Emotionaler Stossdaempfer:
Erste echte Reaktion auf das was der Gast erlebt hat. Verstaendnis zeigen ohne zu dramatisieren.
Keine Erklaerung, keine Verteidigung. Wenn der Gast trotz Kritik empfiehlt oder lobt: das wahrnehmen und kurz wuerdigen.

Slot 2 - Einordnung:
Das Thema auf hoeherer Ebene benennen — ohne die Beschwerde woertlich zu wiederholen.
Ein Satz. Kategorien: Qualitaet / Ablauf / Umgang / Atmosphaere.
Mehrere Probleme: als Gesamteindruck zusammenfassen, niemals aufzaehlen.
Wenn strukturelle Gegebenheiten kritisiert werden (Laerm, Groesse, Auslastung): sachlich einordnen, nicht entschuldigen.

Slot 3 - Haltung ohne leeres Versprechen:
Kein "wir arbeiten daran", kein "intern besprochen", kein Commitment das nichts bedeutet.
Stattdessen: ehrliche Einordnung. Entweder wir stehen zur Entscheidung (Hausregel, Konzept, Atmosphaere) — oder wir gestehen ein dass wir ohne mehr Kontext nicht wissen was genau passiert ist.
NICHT: "Das entspricht nicht unserem Anspruch" / "Wir gehen der Sache nach" / "intern nachgeschaerft".

Abschluss (Pflicht, nach Slot 3):

Abschluss (einheitlich fuer alle Sterne):
${rating <= 2 ? '- Bei 1-2 Sternen: Kein Gespraechsangebot, keine Aufforderung zur Kontaktaufnahme. Stattdessen einen dieser Saetze GENAU SO, WORTWOERTLICH (nur in den Satzbau eingepasst, keine Umformulierung), passend zum Ton der jeweiligen Variante: "Das letzte Wort gehoert dem naechsten Besuch." / "Lass uns beim naechsten Besuch eine andere Geschichte erzaehlen." / "Wir freuen uns auf die naechste Runde."'
  : rating === 3 ? '- Bei 3 Sternen: Kein Gespraechsangebot, keine Aufforderung zur Kontaktaufnahme. Formuliere einen kurzen, eigenen Abschluss-Impuls in diese Richtung (nicht wortwoertlich uebernehmen, sondern passend zum Ton der Variante variieren), z.B.: "Lass uns beim naechsten Mal den vierten Stern gemeinsam holen." / "Lass den naechsten Besuch fuer sich sprechen." / "Wir freuen uns auf die naechste Runde."'
  : '- Bei 4-5 Sternen: Nicht notwendig, optional kurzer warmer Abschluss.'}
Kein Kontaktangebot, keine E-Mail-Adresse in den drei Varianten (siehe Regel im System-Prompt).
Direkt danach folgt NUR der Gruss (z.B. "Viele Gruesse, ..."). Kein weiterer inhaltlicher Satz zwischen Abschluss und Gruss.

Sprachstil:
Die Antwort soll wirken als haette sie ein aufmerksamer Gastronom geschrieben.
Nicht wie Kundenservice, Konzernkommunikation, Rechtsabteilung, Marketingagentur oder KI.
Natuerliche Sprache, kurze Saetze, glaubwuerdige Formulierungen, ruhige Professionalitaet.

Oberstes Prinzip:
Der Gast soll das Gefuehl haben dass seine Kritik gelesen, verstanden und ernst genommen wurde
ohne dass die Antwort die Bewertung nacherzaehlt oder sich rechtfertigt.

Wortwahl: Locker und ehrlich, aber keine vulgaeren Formulierungen.
Natuerliche Alternativen wie "den Geist aufgegeben", "ausgefallen", "gestreikt".

Allgemeine Fallback-Regeln (gelten wenn das Restaurantprofil keine spezifischere Regel enthaelt):

BEI KRITIK AN WARTEZEITEN:
Zu Stosszzeiten ist immer viel Bewegung — Gaeste kommen, Gaeste gehen. Genau in diesen Momenten kann es kurz zu Verzoegerungen kommen. Erklaere das ruhig und ohne Entschuldigung.

BEI KRITIK AM ESSEN OHNE KONKRETEN MANGEL:
Nutze exakt eine dieser beiden Fragen: "War es einfach nicht dein persoenlicher Geschmack oder hat bei der Zubereitung etwas nicht gestimmt?" ODER "Schade, dass es dir nicht geschmeckt hat. Lag es einfach am persoenlichen Geschmack oder lief bei uns im Service oder in der Kueche etwas schief?"

WICHTIGE STRUKTUR-PFLICHT BEI ESSEN + PREIS-KRITIK: Wenn sowohl das Essen (Geschmack/Zubereitung) als auch der Preis kritisiert werden, MUESSEN die Varianten DIREKT & EHRLICH und RUHIG & PROFESSIONELL das PREIS-ARGUMENT enthalten (flexibles Qualitaetsargument, frische Ware, hoher Anspruch, ohne sich zu entschuldigen).
Die "Geschmacks-Weiche" (Frage: "Liegt es an Ihrem persoenlichen Geschmack oder an der Kueche?") darf NUR dann zusaetzlich gestellt werden, wenn der Grund der Essenskritik aus der Bewertung NICHT klar hervorgeht.
Beispiel fuer klaren Grund (keine Weiche): "Portion war zu klein, geschmacklich war das Essen gut" -> Grund klar (Quantitaet, nicht Qualitaet). Beispiel fuer unklaren Grund (Weiche erlaubt): "Das Essen war nicht gut" (ohne weitere Angabe).

BEI KRITIK AN PREISEN ODER PORTIONSGROESSEN:
Kern-Aussage: Unsere Preise sind bewusst so gesetzt, weil wir konsequent auf frische Ware und hohe Qualitaet setzen und hier keine Abstriche machen.
KEIN KONTAKTANGEBOT: Bei reiner Preis- oder Portionskritik KEIN Kontaktangebot machen. Es gibt nichts zu klaeren. Die Antwort endet nach der Haltung, klar und ohne Einladung zur weiteren Diskussion.
STRENGE FORMULIERUNGS-REGEL: Kopiere NICHT in jeder Variante denselben Wortlaut. Der Kernsatz ist nur inhaltliche Richtlinie. Formuliere einen kurzen, eigenen Satz in diese Richtung, der zum Ton der Variante passt (nicht wortwoertlich uebernehmen, sondern variieren), z.B.:
- "Ja, so sind wir nun mal."
- "Das gehoert hier irgendwie dazu."
- "Das macht den Laden hier auf seine eigene Art aus."

BEI KRITIK AN LAUTSTAERKE ODER AMBIENTE:
Je nach Auslastung kann es in einem gut besuchten Restaurant laut und turbulent werden. Kurz anerkennen, nicht dramatisieren.`

  // Analyse-Block — gibt dem Generator Kontext was wirklich wichtig ist
  const analyseBlock = reviewAnalysis
    ? `\nBEWERTUNGS-ANALYSE (als Leitfaden — nicht wortwörtlich verwenden):
${reviewAnalysis}
Wichtig: Wenn der Gast trotz Kritik eine Empfehlung ausspricht, muss die Antwort das wahrnehmen.\n`
    : ''

  // User-Message: nur die Daten — Bewertung + Kontext + Aufgabe
  const userMessage = `${langInstruction}

RESTAURANT: ${businessName}
${context}

${nameRule}

BEWERTUNG (${rating} Sterne):
"${reviewText}"
${analyseBlock}
${alreadyHandled}

Abschluss: Waehle passend zum Ton "Viele Grüße, ${signature}" oder "Herzliche Grüße, ${signature}" oder "Beste Grüße, ${signature}"

Schreibe 3 Varianten. Fuer ALLE gilt strikt: ${duSieAnrede}. ${anredeHinweis}

Variante 1 – Direkt & Ehrlich: Locker, direkt, ehrlich. Startet mit "Hi ${firstNameCapitalized}," oder "Hey ${firstNameCapitalized}," (kein Name bekannt: "Hi," oder "Hey,"). Mehrere Kritikpunkte NIEMALS aufzaehlen oder einzeln nennen — auch nicht abstrakt. Nur als Gesamteindruck einordnen: z.B. "ein Besuch der auf ganzer Linie nicht funktioniert hat" — ohne die einzelnen Punkte zu wiederholen.
Variante 2 – Ruhig & Professionell: Empathisch, ruhig, Mensch zuerst. Startet mit "Hallo ${firstNameCapitalized}," (kein Name bekannt: "Hallo,")
Variante 3 – Fokus auf Klaerung: Kuerzer, max. 3 Saetze. Startet mit "Hi ${firstNameCapitalized}," oder "Hallo ${firstNameCapitalized}," (kein Name bekannt: "Hi," oder "Hallo,"). KEIN E-Mail-Satz und KEIN Kontaktangebot (Kontaktaufnahme ist ausschliesslich Teil der separaten Recovery-Antwort bei 1-2 Sternen, nicht Teil dieser drei Varianten). Die Antwort endet stattdessen mit dem Abschluss gemaess der "Abschluss (einheitlich fuer alle Sterne)"-Regel, gefolgt vom Abschlussgruss.
WICHTIG: Beziehe dich bei Hausregeln NICHT auf den spezifischen Tag aus der Bewertung (z.B. "Samstag") sondern auf die generelle Regel wie sie im Profil steht.

AUSGABE — NUR dieses JSON, kein anderer Text:
{
  "variant1": {"label": "Direkt & Ehrlich", "text": "..."},
  "variant2": {"label": "Ruhig & Professionell", "text": "..."},
  "variant3": {"label": "Fokus auf Klaerung", "text": "..."}
}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── JUDGE PROMPT ──────────────────────────────────────────────────────────
// Der Judge PRUEFT NUR. Er schreibt nie selbst neu.
// Wenn eine Variante schwach ist, gibt er Feedback zurueck — der Generator schreibt neu.
function buildJudgePrompt(
  variants: { label: string; text: string }[],
  reviewText: string,
  signature: string
): string {
  return `Du bist ein strenger Qualitaetspruefer fuer Restaurant-Antworten auf Google-Bewertungen.
Deine einzige Aufgabe: Pruefen und urteilen. Du schreibst NICHTS neu.

BEWERTUNG DES GASTES:
"${reviewText}"

ZUR PRUEFUNG:
Variante 1 (${variants[0]?.label}): "${variants[0]?.text}"
Variante 2 (${variants[1]?.label}): "${variants[1]?.text}"
Variante 3 (${variants[2]?.label}): "${variants[2]?.text}"

PRUEFE JEDE VARIANTE AUF DIESE 4 PUNKTE:

1. NACHERZAEHLUNG
Wiederholt die Antwort den Fehler oder die Kritik woertlich?
Beispiel schlecht: "Dass Sie 45 Minuten warten mussten und die Toiletten zu klein waren..."
Beispiel gut: Einordnung als Gesamteindruck ohne Details zu nennen.
→ SCHWACH wenn ja.

2. VERBOTENE PHRASEN
Enthaelt die Antwort: "intern nachgeschaerft" / "nehmen wir sehr ernst" / "entspricht nicht unserem Anspruch" /
"Massnahmen ergriffen" / "Team sensibilisiert" / "Konsequenzen gezogen" / "Das ist nicht das Erlebnis das wir bieten wollen"?
→ SCHWACH wenn ja.

3. EMPFEHLUNG IGNORIERT
Hat der Gast trotz Kritik das Restaurant empfohlen oder positiv geendet — und die Antwort ignoriert das komplett?
→ SCHWACH wenn ja.

4. KLINGT ES WIE EIN MENSCH?
Klingt die Antwort wie ein echter Gastronom oder wie generierter Kundenservice-Text?
Fehlende Subjekte ("Verstehen Ihren Aerger" statt "Wir verstehen") → SCHWACH.
Leere Worthuelsen ohne echten Inhalt → SCHWACH.
Variante 3 darf kurz sein (max. 3 Saetze) — kurz ist kein Fehler.

AUSGABE — NUR dieses JSON, kein anderer Text:
{
  "variant1": { "ok": true, "reason": "" },
  "variant2": { "ok": true, "reason": "" },
  "variant3": { "ok": true, "reason": "" }
}

Wenn eine Variante schwach ist: "ok": false und "reason" erklaert in einem Satz was genau falsch ist.
Wenn eine Variante gut ist: "ok": true und "reason": ""`
}

// ─── RECOVERY PROMPT ───────────────────────────────────────────────────────
function buildRecoveryPrompt(reviewText: string, reviewerName: string, settings: any): string {
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
  } = settings || {}

  const duSie = salutation === 'Du' ? 'Du/Dein (Duzen)' : 'Sie/Ihr (Siezen)'
  const signature = responseSignature || `Das Team von ${businessName}`
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const firstNameClean = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  const langInstruction = responseLanguage === 'Sprache des Bewerters'
    ? 'Antworte in der Sprache der Bewertung.'
    : responseLanguage === 'Englisch'
    ? 'Respond in English only.'
    : 'Antworte auf Deutsch.'

  const systemPrompt = `Erstelle eine deeskalierende, menschliche und verantwortungsvolle Antwort auf eine sehr negative Google-Bewertung.
Schreibe wie ein aufmerksamer Gastronom — nicht wie Kundenservice, PR-Agentur oder KI.

Grundregeln:
Beschwerden nicht nacherzählen oder wörtlich wiederholen.
Kritik nicht spiegeln.
Keine Ursachen erfinden.
Keine leeren Floskeln.
Natürliche Sprache, kurze Sätze.
Nutze echte Umlaute: ä, ö, ü, ß — niemals ae, oe, ue als Ersatz.

Ziel: Vertrauen zurückgewinnen und persönliche Klärung anbieten.
Länge: 3 bis 4 vollständige, fließende Sätze.
Korrekte Zeichensetzung — jeder Hauptsatz beginnt nach einem Punkt.`

  const recoveryContext = [
    description          && `Beschreibung: ${description}`,
    restaurantType       && `Typ: ${restaurantType}`,
    cuisineType          && `Kueche: ${cuisineType}`,
    restaurantAtmosphere && `Atmosphaere: ${restaurantAtmosphere}`,
    uniqueSellingPoints  && `Besonderheiten: ${uniqueSellingPoints}`,
  ].filter(Boolean).join('\n')

  const userMessage = `${langInstruction} Anredeform: ${duSie}

Restaurant: ${businessName}
${recoveryContext}
${contactEmail ? `Kontakt-E-Mail: ${contactEmail}` : ''}

Bewertung von ${firstNameClean || 'einem Gast'} (1-2 Sterne):
"${reviewText}"

Schreibe EINE deeskalierende Antwort.
${firstNameClean ? `Beginne mit "Hallo ${firstNameClean},"` : 'Kein Name bekannt — ohne persoenliche Anrede beginnen.'}
${contactEmail ? `Kontaktangebot: Bitte melde dich kurz unter ${contactEmail}, damit wir das persönlich klären können.` : ''}
Endet mit: ${signature}

AUSGABE — NUR dieses JSON:
{"label":"Deeskalierend","text":"..."}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── HELPER: GEMINI API CALL (Generator) ──────────────────────────────────
async function callGemini(userMessage: string, systemPrompt?: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`

  const body: any = {
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
  }
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Gemini API Fehler: ${JSON.stringify(err)}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ─── HELPER: CLAUDE API CALL (Judge & Recovery) ────────────────────────────
async function callClaude(userMessage: string, systemPrompt?: string): Promise<string> {
  const body: any = {
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: userMessage }],
  }
  if (systemPrompt) {
    body.system = systemPrompt
  }

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

// ─── HELPER: JSON PARSE ────────────────────────────────────────────────────
function parseVariants(raw: string): { label: string; text: string; isRecovery?: boolean }[] {
  let jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const startIdx = jsonStr.indexOf('{')
  const endIdx = jsonStr.lastIndexOf('}')

  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Kein JSON gefunden: ' + raw)
  }

  jsonStr = jsonStr.substring(startIdx, endIdx + 1)
  const parsed = JSON.parse(jsonStr)

  const cleanText = (t: string) => t.replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim()

  return [
    { label: parsed.variant1?.label || 'Variante 1', text: cleanText(parsed.variant1?.text || '') },
    { label: parsed.variant2?.label || 'Variante 2', text: cleanText(parsed.variant2?.text || '') },
    { label: parsed.variant3?.label || 'Variante 3', text: cleanText(parsed.variant3?.text || '') },
  ]
}

// ─── REVIEW ANALYSE ────────────────────────────────────────────────────────
// Liest die Bewertung durch und extrahiert was wirklich wichtig ist —
// damit der Generator gezielt antworten kann statt blind loszuschreiben.
async function analyzeReview(reviewText: string, rating: number): Promise<string> {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 6) return ''

  const systemPrompt = `Du analysierst eine einzelne Google-Bewertung fuer ein Restaurant.
Deine Aufgabe: Herausfinden was der Gast wirklich meint — damit die Antwort gezielt und menschlich wirkt.
Antworte NUR mit dem JSON. Kein weiterer Text, keine Erklaerung.`

  const userMessage = `Bewertung (${rating} Sterne):
"${reviewText}"

Analysiere und antworte NUR mit diesem JSON:
{
  "emotionalerKern": "Was hat den Gast wirklich beschaeftigt — nicht die Fakten, sondern das Gefuehl dahinter. Ein Satz.",
  "hauptthema": "Das eine wichtigste Thema der Bewertung — ein Stichwort (z.B. Wartezeit, Service, Preis-Leistung)",
  "nebenpunkte": ["weitere erwaehnte Punkte, max. 2, nur wenn wirklich relevant"],
  "lob": ["was der Gast ausdruecklich positiv erwaehnt hat — leer lassen wenn nichts"],
  "empfiehltRestaurant": true,
  "ton": "sachlich | enttaeuscht | emotional | aggressiv | ironisch | erfreut | gemischt",
  "erwartetReaktion": true,
  "fazit": "Ein Satz: Was braucht diese Antwort damit der Gast sich wirklich gehoert fuehlt?"
}`

  try {
    const result = await callClaude(userMessage, systemPrompt)
    const start = result.indexOf('{')
    const end = result.lastIndexOf('}')
    if (start === -1 || end === -1) return ''
    return result.substring(start, end + 1)
  } catch (e) {
    console.error('Review-Analyse fehlgeschlagen, weiter ohne:', e)
    return ''
  }
}

// ─── CONTEXT CHECK ─────────────────────────────────────────────────────────
// Prüft ob die Description genug Kontext liefert um die Bewertung sicher zu beantworten.
// Läuft VOR der eigentlichen Generierung. Ändert nichts am bestehenden Code darunter.
async function checkContext(reviewText: string, description: string): Promise<{ ok: boolean; missing?: string }> {
  // Wenn kein Text in der Bewertung — kein Kontext nötig, immer OK
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 6) return { ok: true }

  const systemPrompt = `Du bist ein strikter Qualitätsprüfer für Restaurant-Antworten.
Deine einzige Aufgabe: Entscheide ob das Restaurantprofil genug Informationen enthält um auf diese Bewertung sicher zu antworten — ohne etwas erfinden zu müssen.

Antworte NUR mit einem dieser zwei Formate:
OK
MISSING: [kurze Beschreibung was fehlt, max. 1 Satz auf Deutsch]

Wann ist MISSING korrekt?
- Die Bewertung enthält einen konkreten Vorwurf über eine spezifische Situation oder Entscheidung des Restaurants (z.B. Platzvergabe, Reservierungspolitik, Hausregeln, spezifische Abläufe)
- UND das Profil enthält dazu keine Erklärung oder Regel

Wann ist OK korrekt?
- Allgemeine Kritik (Essen, Service, Wartezeit, Atmosphäre) — hier braucht die KI keine Hausregeln
- Das Profil enthält eine passende Erklärung zur Situation
- Die Bewertung ist positiv oder neutral

Sei NICHT überstreng. Im Zweifel: OK.`

  const userMessage = `RESTAURANTPROFIL:
${description || '(keine Beschreibung eingetragen)'}

BEWERTUNG:
"${reviewText}"

Ist das Profil ausreichend um sicher zu antworten?`

  try {
    const result = await callClaude(userMessage, systemPrompt)
    const trimmed = result.trim()
    if (trimmed.startsWith('MISSING:')) {
      const missing = trimmed.replace('MISSING:', '').trim()
      return { ok: false, missing }
    }
    return { ok: true }
  } catch (e) {
    // Im Fehlerfall: immer OK — lieber generieren als blockieren
    console.error('Context check failed, proceeding anyway:', e)
    return { ok: true }
  }
}

// ─── HANDLER ───────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { review, settings } = req.body

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' })
  }

  const reviewText = review.reviewText || ''
  const stars = review.stars || 3
  const reviewerName = review.reviewerName || ''

  const salutation = settings?.salutation || 'Sie'
  const businessName = settings?.businessName || 'das Restaurant'
  const signature = settings?.responseSignature || `Das Team von ${businessName}`

  try {
    // ── SCHRITT 0: Context Check ──────────────────────────────────────────
    const description = settings?.description || ''
    const contextCheck = await checkContext(reviewText, description)
    if (!contextCheck.ok) {
      return res.status(200).json({
        success: false,
        missingContext: true,
        missingInfo: contextCheck.missing || 'Fehlende Informationen im Restaurantprofil',
      })
    }

    // ── SCHRITT 0b: Review analysieren ───────────────────────────────────
    const reviewAnalysis = await analyzeReview(reviewText, stars)

    // ── SCHRITT 1: Generator ──────────────────────────────────────────────
    const generatorRaw_str = buildPrompt(reviewText, stars, reviewerName, settings, reviewAnalysis)
    let generatorRaw: string

    try {
      const parsed = JSON.parse(generatorRaw_str)
      if (parsed._system && parsed._user) {
        generatorRaw = await callClaude(parsed._user, parsed._system)
      } else {
        generatorRaw = await callClaude(generatorRaw_str)
      }
    } catch {
      generatorRaw = await callClaude(generatorRaw_str)
    }

    let generatedVariants = parseVariants(generatorRaw)

    // ── SCHRITT 2: Judge — prueft, gibt Feedback, Generator schreibt bei Bedarf neu ──
    const mode = classify(stars, reviewText)
    let finalVariants = generatedVariants

    // Judge nur bei CONTENT-Modi sinnvoll (nicht bei leeren Bewertungen)
    if (mode !== 'EMPTY_POSITIVE' && mode !== 'EMPTY_NEGATIVE') {
      try {
        const judgePrompt = buildJudgePrompt(generatedVariants, reviewText, signature)
        const judgeRaw = await callClaude(judgePrompt)
        const judgeStart = judgeRaw.indexOf('{')
        const judgeEnd = judgeRaw.lastIndexOf('}')

        if (judgeStart !== -1 && judgeEnd !== -1) {
          const judgeResult = JSON.parse(judgeRaw.substring(judgeStart, judgeEnd + 1))

          // Fuer jede schwache Variante: Generator neu aufrufen mit Judge-Feedback
          const variantKeys = ['variant1', 'variant2', 'variant3'] as const
          const needsRewrite = variantKeys.some(k => judgeResult[k]?.ok === false)

          if (needsRewrite) {
            // Feedback zusammenbauen und an Generator schicken
            const feedbackLines = variantKeys
              .filter(k => judgeResult[k]?.ok === false)
              .map((k, i) => `Variante ${i + 1}: ${judgeResult[k].reason}`)
              .join('\n')

            const rewriteParsed = JSON.parse(generatorRaw_str)
            const rewriteUser = rewriteParsed._user
              ? `${rewriteParsed._user}\n\nQUALITAETSFEEDBACK — bitte diese Varianten verbessern:\n${feedbackLines}`
              : `${generatorRaw_str}\n\nQUALITAETSFEEDBACK — bitte diese Varianten verbessern:\n${feedbackLines}`

            const rewriteSystem = rewriteParsed._system || undefined
            const rewriteRaw = await callClaude(rewriteUser, rewriteSystem)
            const rewrittenVariants = parseVariants(rewriteRaw)

            // Nur schwache Varianten ersetzen, gute behalten
            finalVariants = generatedVariants.map((v, i) => {
              const key = variantKeys[i]
              return judgeResult[key]?.ok === false ? rewrittenVariants[i] : v
            })
          }
        }
      } catch (e) {
        console.error('Judge fehlgeschlagen, weiter mit Original:', e)
        finalVariants = generatedVariants
      }
    }

    // ── SCHRITT 3: Recovery (nur bei 1–2 Sternen) ─────────────────────────
    if (stars <= 2) {
      try {
        const recoveryPrompt_str = buildRecoveryPrompt(reviewText, reviewerName, settings)
        let recoveryRaw: string
        try {
          const recoveryParsed = JSON.parse(recoveryPrompt_str)
          if (recoveryParsed._system && recoveryParsed._user) {
            recoveryRaw = await callClaude(recoveryParsed._user, recoveryParsed._system)
          } else {
            recoveryRaw = await callClaude(recoveryPrompt_str)
          }
        } catch {
          recoveryRaw = await callClaude(recoveryPrompt_str)
        }
        let recoveryJson = recoveryRaw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        const rs = recoveryJson.indexOf('{')
        const re = recoveryJson.lastIndexOf('}')
        if (rs !== -1 && re !== -1) {
          recoveryJson = recoveryJson.substring(rs, re + 1)
          const parsed = JSON.parse(recoveryJson)
          if (parsed.text) {
            const cleanText = (t: string) => t.replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim()
            finalVariants = [
              ...finalVariants,
              { label: parsed.label || 'Deeskalierend', text: cleanText(parsed.text), isRecovery: true }
            ]
          }
        }
      } catch (e) {
        console.error('Recovery generation failed:', e)
      }
    }

    return res.status(200).json({ success: true, answers: finalVariants })

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies FEHLER:', errMsg)
    return res.status(500).json({ error: 'Serverfehler', details: errMsg })
  }
}
