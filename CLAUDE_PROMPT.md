# Arbeitsweise für Rezpond Projekt

Du arbeitest an einem laufenden SaaS-Projekt namens **Rezpond**.
Bitte halte dich immer an folgende Vorgehensweise:

---

## Projektüberblick
- **Live-URL:** https://review-manager-mu.vercel.app
- **GitHub:** https://github.com/luckyalp/Review-Manager
- **Stack:** React + TypeScript (Vite), Vercel Serverless Functions, Supabase (PostgreSQL), Claude API (Anthropic), Resend (E-Mail)
- **Lokaler Pfad:** `C:\Users\Alp\Downloads\ReviewManager\ReviewApp`
- **Roadmap:** `C:\Users\Alp\Downloads\ReviewManager\ReviewApp\project-docs\roadmap`
- **Hauptdateien:**
  - `src/App.tsx` — gesamte Frontend-App
  - `api/generate-replies.ts` — KI-Antworten generieren
  - `api/send-email.ts` — E-Mail-Versand
  - `api/confirm-reply.ts` — Antwort bestätigen

---

## Farbschema (Petrol-Palette)
- Primary: `#0f4c5c` (Petrol)
- Mid: `#155e75`
- Light: `#1e7a8c`
- Teal (Recovery): `#0e7490`
- Background: `#f7f5f2` (Sand)
- Border: `#e2ddd8`
- **Kein Lila/Indigo** (`#4f46e5` etc.) mehr verwenden

---

## ReviewDetail Komponente
- 3 normale Antwortvarianten (Petrol)
- 1 Recovery-Karte bei 1–2 Sternen (Teal, linker Balken, Separator "Empfohlen bei 1–2 Sternen")
- Inline-Editierbar nach Auswahl
- Send-Bar unten

---

## Deine Arbeitsweise — immer so vorgehen:

1. **Frage was geändert werden soll** — kurz und klar
2. **Frage nach den relevanten Dateien** — lass sie hochladen
3. **Analysiere die Datei** — finde die genaue Stelle
4. **Erstelle die geänderte Datei** — komplett, nicht nur den Patch
5. **Schicke den git-Befehl** am Ende:
```
git add .
git commit -m "Beschreibung der Änderung"
git push origin main
```

---

## Wichtige Regeln
- **Niemals** Dateien neu schreiben ohne die aktuelle Version hochgeladen zu haben
- **Immer** die komplette Datei ausgeben — nicht nur Ausschnitte
- **Immer** prüfen ob Änderungen wirklich in der Datei gelandet sind (Python-Check)
- Bei Unsicherheit: kurz fragen, nicht raten
- Der Nutzer ist kein Entwickler — Erklärungen kurz und ohne Fachjargon

---

## Häufige Fehlerquellen (aus Erfahrung)
- `useRef` muss importiert sein wenn ReviewDetail verwendet wird
- Alte Recovery-Karte (`🔴 Persönliche Kontaktaufnahme`) darf nicht mehr im Code sein
- `generate-replies.ts` liefert nur 3 Varianten — Recovery kommt vom Frontend
- Farbe `#4f46e5` (Lila) darf nirgends mehr auftauchen
- `overflow: hidden` auf Answer-Cards schneidet den Teal-Balken ab — nicht verwenden
- localStorage-Key heißt `rezpondSettings` (nicht reviewManagerSettings)
- `ReviewDetail.tsx` in project-docs ist veraltet — ReviewDetail ist direkt in App.tsx eingebaut
- WelcomeScreen-Banner: `rezpondWelcomeDismissed` in localStorage steuert Sichtbarkeit
