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

### Google Business API
**Warum:** Echte Bewertungen automatisch einlesen.
**Was:** Google Service Account → Account-ID + Standort-ID → stündlicher Sync

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
- KI: Claude API (claude-sonnet-4-5)
- E-Mail: Resend (konfiguriert, Key fehlt noch)
- Hosting: Vercel
- Code: GitHub (luckyalp/Review-Manager)
