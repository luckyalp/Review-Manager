# ReviewManager — Roadmap & Offene Aufgaben

## Erledigt ✅
- Voice of Ton System (3 Varianten + Recovery)
- Stern-Routing (leer/Text, positiv/negativ/Recovery)
- Supabase Integration (reviews, settings)
- Petrol-Farbpalette, kein Lila mehr
- Judge-Layer (Qualitätsprüfung nach Generierung)
- Engine auf Claude API migriert (claude-sonnet-4-5)
- Anti-Eleganz-Kalibrierung (weniger "komponiert", mehr echt)
- Variante 3 entliteraturisiert ("Kurz & beiläufig")
- Feedback-Loop: gewählte Variante wird in Supabase gespeichert
  - `selected_variant_label` + `selected_variant_index`
- Analytics-Tab: Varianten-Auswertung (welche wird gewählt?)
- Feste Varianten-Labels (stabile Kategorien statt dynamischer Modell-Benennung)
  - 1 → "Ruhig & direkt"
  - 2 → "Menschlich & nah"
  - 3 → "Kurz & beiläufig"
  - recovery → "Deeskalierend"
- Mikrokalibrierung: Sprachmuster echter Gastronomie-Kommunikation
- **KI-Engine auf Gemini 3 Flash Preview migriert** (Generator + Recovery, via Google REST API)
  - Judge-Layer deaktiviert — Gemini Output wird direkt verwendet
  - System/User-Prompt-Split für echte `systemInstruction`-Übergabe an die API
  - Slot-Architektur (5 Slots: Stoßdämpfer → Abstraktion → Commitment → Brückenbauer → Abschluss)
  - Anredeform (Du/Sie) einheitlich aus Profil-Settings für alle Varianten
  - Recovery ebenfalls auf Gemini umgestellt (kein Claude mehr aktiv)
  - Temperatur: 0.7 für natürlichere Ausgabe
- **Neue Varianten-Struktur:**
  - 1 → "Direkt & Ehrlich" (locker, direkt)
  - 2 → "Ruhig & Professionell" (empathisch, Mensch zuerst)
  - 3 → "Fokus auf Klärung" (kurz, Kontaktkanal im Vordergrund)
  - recovery → "Deeskalierend"
- **E-Mail-System vollständig implementiert** (send-email.ts + confirm-reply.ts)
  - Zeigt Gemini-Antworten automatisch
  - RESEND_API_KEY muss noch in Vercel eingetragen werden

---

## Nächste Schritte 🔴

### Adaptive Priorisierung (Stufe 2 Feedback-Loop)
**Warum:** Wenn Variante 2 bei 1★-Reviews zu 68% gewählt wird → sie zuerst anzeigen.
**Was:**
- Supabase-Abfrage: welche Variante gewinnt bei welchem Rating?
- Sortierung der 3 Karten dynamisch anpassen
- Schwellenwert: erst ab ~20 Datenpunkten aktivieren

### Analytics: Rating-Aufschlüsselung
**Warum:** "Variante 2 bei 1★" ist wertvoller als "Variante 2 gesamt"
**Was:**
- Varianten-Auswertung nach Sternzahl aufschlüsseln
- Tabelle: Welche Variante gewinnt bei welchem Rating?

---

## Mittelfristig 🟡

### Echte Prompt-Anpassung (Stufe 3 Feedback-Loop)
**Warum:** Die Daten zeigen welche Stilrichtung performt — das fließt zurück in den Prompt.
**Was:**
- Kürzere Antworten wenn Variante 3 dominiert
- Empathischere Einstiege wenn Variante 2 dominiert
- Das ist die "geheime Sauce" — kontrolliertes Lernen

### Stärkere Differenzierung der 3 Varianten
**Ziel:** Nutzer sollen wirklich zwischen Strategien wählen — nicht zwischen Umformulierungen.

| Variante | Zielgefühl |
|---|---|
| Ruhig & direkt | souverän, klar, professionell |
| Menschlich & nah | warm, empathisch, verbindend |
| Kurz & beiläufig | locker, unkompliziert, natürlich |
| Deeskalierend | Spannung rausnehmen |

**Warum wichtig:** Wenn Unterschiede klarer → Analytics sinnvoller → Feedback-Loop stärker.

### Google Business API (OAuth)
**Warum:** Echte Bewertungen automatisch einlesen — ohne manuellen Setup.
**Was:**
- OAuth-Button: Kunde klickt "Mit Google verbinden" → Login mit Google-Business-Account → fertig
- Kein Service Account Key, keine manuellen IDs
- Erster Sync: nur die letzten **90 Tage**, nur **unbeantwortete** Bewertungen
  - Ältere Bewertungen zu beantworten macht keinen Sinn mehr
  - Beim ersten Sync geht **keine einzige E-Mail raus** (sonst 90 E-Mails auf einmal)
- Laufender Sync: **stündlich** via Vercel Cron-Job (`vercel.json`)
  - Nur neue Bewertungen seit letztem Sync
  - Bei jeder neuen Bewertung: E-Mail mit 3 KI-Antworten an den Gastronom
- Neue Datei: `api/sync-reviews.ts`
- Eintrag in `vercel.json`: `{ "crons": [{ "path": "/api/sync-reviews", "schedule": "0 * * * *" }] }`

### E-Mail Benachrichtigung (Resend)
**Status:** Funktion existiert, RESEND_API_KEY in Vercel hinterlegen reicht.

---

## Irgendwann 🔵

### WhatsApp Benachrichtigung
- Nach E-Mail als zweiter Kanal (WhatsApp Business API)

### Restaurant-Profil automatisch ableiten
- KI liest Webseite + Social Media, erstellt Stimmprofil automatisch

### Multi-Restaurant / Login
- Aktuell: eine App, ein Restaurant
- Später: jeder Kunde hat eigenen Login und Profil

### Automatische Datenlöschung
- Beantwortet → nach 90 Tagen löschen
- Abgelehnt → sofort oder nach kurzer Zeit

---

## Technischer Stack
- Frontend: React + TypeScript (Vite)
- Backend: Vercel Serverless Functions
- Datenbank: Supabase (PostgreSQL)
- KI: Gemini 3 Flash Preview (Google Generative AI REST API) — Generator + Recovery
- KI Fallback: Claude Sonnet 4-6 (Anthropic) — Funktion im Code vorhanden, nicht aktiv
- E-Mail: Resend (konfiguriert, RESEND_API_KEY in Vercel einzutragen)
- Hosting: Vercel
- Code: GitHub (luckyalp/Review-Manager)
