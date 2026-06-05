# Rezpond — Roadmap & Offene Aufgaben

## Erledigt ✅

### KI & Antwort-Engine
- Voice of Ton System (3 Varianten + Recovery)
- Stern-Routing (leer/Text, positiv/negativ/Recovery)
- Judge-Layer (Qualitätsprüfung nach Generierung)
- Anti-Eleganz-Kalibrierung (weniger "komponiert", mehr echt)
- Variante 3 entliteraturisiert ("Kurz & beiläufig")
- Mikrokalibrierung: Sprachmuster echter Gastronomie-Kommunikation
- Slot-Architektur (5 Slots: Stoßdämpfer → Abstraktion → Commitment → Brückenbauer → Abschluss)
- Anredeform (Du/Sie) einheitlich aus Profil-Settings
- Temperatur: 0.7 für natürlichere Ausgabe
- KI-Engine: Gemini 3 Flash Preview (Generator + Recovery)
- KI Fallback: Claude Sonnet 4-6 (im Code vorhanden, nicht aktiv)

### Varianten-Labels (fest)
- 1 → "Direkt & Ehrlich"
- 2 → "Ruhig & Professionell"
- 3 → "Fokus auf Klärung"
- recovery → "Deeskalierend"

### Infrastruktur & Auth
- Supabase Integration (reviews, settings, google_tokens)
- Multi-Tenant Login — jeder Nutzer sieht nur seine eigenen Daten
- Row Level Security — Datenbank auf Datenbankebene abgesichert
- Google OAuth Login (E-Mail + Google)
- Google Business Profile OAuth — Bewertungen automatisch einlesen
- Stündlicher Vercel Cron-Job (sync-reviews.ts)
- Erster Sync: nur letzte 90 Tage, nur unbeantwortete Bewertungen, keine E-Mails

### E-Mail & Benachrichtigungen
- E-Mail-System vollständig implementiert (send-email.ts + confirm-reply.ts)
- Resend Domain verifiziert, RESEND_API_KEY in Vercel eingetragen

### Frontend & UX
- Petrol-Farbpalette (#0f4c5c, #155e75, #1e7a8c), kein Lila
- Rebranding: Rezpond (nicht mehr ReviewManager/ReviewMonitor)
- Feedback-Loop: gewählte Variante wird in Supabase gespeichert
- Analytics-Tab: Varianten-Auswertung (welche wird gewählt?)
- Fake-Daten in Analytics entfernt — leere Zustände statt Platzhalter
- Manueller Test-Button im Dashboard (bewusst nicht gespeichert)

---

## Nächste Schritte 🔴

### Bruder onboarden
- Henry's Sandbar Google Account verbinden
- Erste echte Bewertungen einlesen
- E-Mail-Benachrichtigung testen

### Analytics: Rating-Aufschlüsselung
**Warum:** "Variante 2 bei 1★" ist wertvoller als "Variante 2 gesamt"
- Varianten-Auswertung nach Sternzahl aufschlüsseln
- Tabelle: Welche Variante gewinnt bei welchem Rating?

### Adaptive Priorisierung (Stufe 2 Feedback-Loop)
**Warum:** Wenn Variante 2 bei 1★-Reviews zu 68% gewählt wird → sie zuerst anzeigen.
- Supabase-Abfrage: welche Variante gewinnt bei welchem Rating?
- Sortierung der 3 Karten dynamisch anpassen
- Schwellenwert: erst ab ~20 Datenpunkten aktivieren

---

## Mittelfristig 🟡

### Echte Prompt-Anpassung (Stufe 3 Feedback-Loop)
**Warum:** Die Daten zeigen welche Stilrichtung performt — das fließt zurück in den Prompt.
- Kürzere Antworten wenn Variante 3 dominiert
- Empathischere Einstiege wenn Variante 2 dominiert
- Das ist die "geheime Sauce" — kontrolliertes Lernen

### Stärkere Differenzierung der 3 Varianten
**Ziel:** Nutzer sollen wirklich zwischen Strategien wählen — nicht zwischen Umformulierungen.

| Variante | Zielgefühl |
|---|---|
| Direkt & Ehrlich | souverän, klar, locker |
| Ruhig & Professionell | warm, empathisch, Mensch zuerst |
| Fokus auf Klärung | kurz, Kontaktkanal im Vordergrund |
| Deeskalierend | Spannung rausnehmen |

### Dashboard "Google verbunden" Status
- Anzeige ob Google Account verbunden ist
- Letzter Sync-Zeitpunkt sichtbar

### Positiv/Negativ Themen aus echten Bewertungen
- KI analysiert Bewertungstexte und extrahiert wiederkehrende Themen
- Ersetzt die aktuell leeren Karten in Analytics

---

## Irgendwann 🔵

### WhatsApp Benachrichtigung
- Nach E-Mail als zweiter Kanal (WhatsApp Business API)

### Restaurant-Profil automatisch ableiten
- KI liest Webseite + Social Media, erstellt Stimmprofil automatisch

### Automatische Datenlöschung
- Beantwortet → nach 90 Tagen löschen
- Abgelehnt → sofort oder nach kurzer Zeit

### App-Code aufräumen
- App.tsx in einzelne Komponenten aufteilen
- Erst nach stabilem Betrieb mit echten Daten

---

## Technischer Stack
- Frontend: React + TypeScript (Vite)
- Backend: Vercel Serverless Functions
- Datenbank: Supabase (PostgreSQL) mit Row Level Security
- KI: Gemini 3 Flash Preview — Generator + Recovery
- KI Fallback: Claude Sonnet 4-6 (Anthropic) — vorhanden, nicht aktiv
- E-Mail: Resend (domain verifiziert, key eingetragen)
- Hosting: Vercel (auto-deploy via GitHub)
- Code: GitHub (luckyalp/Review-Manager, branch: main)
