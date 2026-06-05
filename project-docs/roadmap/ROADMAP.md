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
- KI-Engine: umgestellt auf Claude Sonnet 4-6 (Anthropic) — Gemini als Fallback im Code
- KI-Analyse in Insights: echte Gemini-Auswertung mit Zeitraum-Auswahl

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
- Google Reply API — Antworten werden direkt auf Google gepostet (post-reply.ts)
  - Aus der E-Mail heraus ("Sofort senden") → postet zu Google
  - Aus dem Dashboard heraus ("Antwort senden") → postet zu Google
  - Noch nicht mit echter Bewertung getestet — erster Test mit Bruder ausstehend

### E-Mail & Benachrichtigungen
- E-Mail-System vollständig implementiert (send-email.ts + confirm-reply.ts)
- Resend Domain verifiziert, RESEND_API_KEY in Vercel eingetragen

### Frontend & UX
- Petrol-Farbpalette (#0f4c5c, #155e75, #1e7a8c), kein Lila
- Rebranding: Rezpond (nicht mehr ReviewManager/ReviewMonitor)
- Feedback-Loop: gewählte Variante wird in Supabase gespeichert
- Analytics-Tab: Varianten-Auswertung (welche wird gewählt?)
- KI-Analyse Button: echter Gemini-Call mit Zeitraum-Auswahl + Empfehlungen
- Themen-Karten (positiv/negativ): laden automatisch beim Öffnen der Insights-Seite
- Fake-Daten in Analytics entfernt — leere Zustände statt Platzhalter
- Manueller Test-Button im Dashboard (bewusst nicht gespeichert)

---

## Nächste Schritte 🔴

### Bruder onboarden + Google Reply testen
- Henry's Sandbar Google Account verbinden
- Erste echte Bewertungen einlesen
- E-Mail-Benachrichtigung testen
- "Sofort senden" aus E-Mail → prüfen ob Antwort auf Google erscheint
- "Antwort senden" aus Dashboard → prüfen ob Antwort auf Google erscheint

### DSGVO Basics
- Datenschutzerklärung in der App (Link im Footer/Login)
- Impressum (über estländische OÜ)
- AVV mit Anthropic + Resend akzeptieren
- Hinweis in der App dass Bewertungstexte an KI-Dienste weitergegeben werden
- Vor erstem zahlenden Kunden erledigen

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
- Kürzere Antworten wenn Variante 3 dominiert
- Empathischere Einstiege wenn Variante 2 dominiert
- Das ist die "geheime Sauce" — kontrolliertes Lernen

### Stärkere Differenzierung der 3 Varianten
| Variante | Zielgefühl |
|---|---|
| Direkt & Ehrlich | souverän, klar, locker |
| Ruhig & Professionell | warm, empathisch, Mensch zuerst |
| Fokus auf Klärung | kurz, Kontaktkanal im Vordergrund |
| Deeskalierend | Spannung rausnehmen |

### Dashboard "Google verbunden" Status
- Anzeige ob Google Account verbunden ist
- Letzter Sync-Zeitpunkt sichtbar

### Erster zahlender Kunde
- Onboarding-Flow für neue Gastronomen
- Preismodell festlegen
- Zahlungsabwicklung (Stripe o.ä.)

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
- KI Generator: Claude Sonnet 4-6 (Anthropic) — aktiv
- KI Analyse: Gemini 3 Flash Preview — aktiv (Insights)
- KI Fallback: Gemini 3 Flash Preview — im Code vorhanden, nicht aktiv
- E-Mail: Resend (domain verifiziert, key eingetragen)
- Hosting: Vercel (auto-deploy via GitHub)
- Code: GitHub (luckyalp/Review-Manager, branch: main)
