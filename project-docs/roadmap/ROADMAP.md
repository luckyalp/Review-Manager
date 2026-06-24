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
- KI-Engine: umgestellt auf Claude Sonnet 4-6 (Anthropic) — Gemini als Fallback im Code (callGemini Funktion vorhanden aber nicht aktiv)
- Welcome-Box: veralteter Hinweis auf "Bewertung hinzufügen" entfernt (08.06.2026)
- post-reply.ts: readMask-Fix — locations API 400-Fehler behoben (08.06.2026)
- generate-replies.ts: besseres Error-Logging — 500er liefern jetzt konkrete Fehlermeldung (08.06.2026)
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
- Auth: Fehlermeldung bei bereits registrierter E-Mail mit "Jetzt anmelden"-Button (08.06.2026)
- Auth: Passwort vergessen Funktion eingebaut (08.06.2026)
- Auth: Doppelte E-Mail zuverlässig via identities-Check erkannt (08.06.2026)
- Supabase SMTP auf Resend umgestellt — Auth-E-Mails laufen über noreply@hiptoys.de (08.06.2026)
- Supabase Site URL von localhost:3000 auf https://review-manager-mu.vercel.app umgestellt (08.06.2026)
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


### Profil-basierter Abschluss-Satz für Hausregel-Antworten (A-Kategorie)
**Warum:** Der aktuelle Bar/Stehtisch-Satz ist fest im Code für Henry's Sandbar einprogrammiert. Für Kunde Nr. 2 stimmt das nicht.
**Lösung:** Neues Profilfeld "Was können Gäste tun wenn die Hausregel greift?" — der Gastronom trägt selbst ein was als Alternative gilt. Dieser Text ersetzt den festen Code-Satz.
**Aufwand:** ~1 Tag. Erst relevant wenn zweiter Kunde onboarded wird.
### Dashboard "Google verbunden" Status
- Anzeige ob Google Account verbunden ist
- Letzter Sync-Zeitpunkt sichtbar

### Erster zahlender Kunde
- Onboarding-Flow für neue Gastronomen
- Preismodell festlegen
- Zahlungsabwicklung (Stripe o.ä.)

---

## Irgendwann 🔵

### Brückensätze-Bibliothek in Prompt einbauen
Vorgefertigte Sätze pro Kategorie — die KI greift darauf zurück statt selbst zu erfinden.
Kategorien bereits recherchiert (brueckensaetze_bewertungsantworten.html gespeichert):
- Wartezeit Tisch: Satz 1 + 3 verwendbar
- Wartezeit Bestellung: Satz 1 + 2 verwendbar
- Wartezeit Rechnung: Satz 2 verwendbar
- Service allgemein: Satz 1 verwendbar
- Essen Geschmack: Satz 1 + 3 verwendbar
- Lautstärke / Atmosphäre: Satz 2 verwendbar
- Beschwerde ohne konkreten Grund: Satz 1 verwendbar

Nächster Schritt: Sätze final abstimmen und in generate-replies.ts als Fallback-Regeln einbauen.

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

## Modell-Wechsel: Was müsste geändert werden?

Aktuell läuft der **Generator** (Antworten erstellen), der **Judge** (Qualitätsprüfung), der **Context Check** und die **Recovery-Karte** alle über Claude (callClaude in generate-replies.ts).

Die callGemini Funktion ist im Code vorhanden und einsatzbereit — wird aber nicht aufgerufen.

### Falls du zurück zu Gemini willst:
In generate-replies.ts an drei Stellen `callClaude` → `callGemini` ersetzen:
1. Schritt 0: Context Check → `callClaude` in `checkContext()`
2. Schritt 1: Generator → `callClaude` im Handler
3. Schritt 3: Recovery → `callClaude` im Recovery-Block

**Außerdem:** Gemini-Modellname in `callGemini` prüfen — aktuell steht dort `gemini-3-flash-preview` (war beim letzten Wechsel der aktuelle Name, könnte veraltet sein).

### KI-Analyse (Insights-Tab):
Läuft bereits separat über Gemini — wird vom Modell-Wechsel oben nicht berührt.

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

---

## Domain-Wechsel (wenn rezpond.com live geht) 🔄

Wenn die echte Domain aktiv ist, sind genau **3 Schritte** nötig:

### Schritt 1 — Resend
- resend.com → Domains → "Add domain"
- `rezpond.com` hinzufügen
- DNS-Einträge beim Domain-Anbieter setzen (Resend zeigt sie an)
- Warten bis Status "Verified" erscheint (~5–30 Min)

### Schritt 2 — Supabase SMTP
- supabase.com → Authentication → Emails → SMTP Settings
- **Sender email address** ändern: `noreply@hiptoys.de` → `noreply@rezpond.com`
- Save changes

### Schritt 3 — Supabase URL
- supabase.com → Authentication → URL Configuration
- **Site URL** ändern: `https://review-manager-mu.vercel.app` → `https://rezpond.com`
- Unter **Redirect URLs** die neue Domain ergänzen
- Save changes

**Was NICHT geändert werden muss:** API Key, SMTP Host/Port/Username, Code, Vercel, GitHub — alles bleibt.
