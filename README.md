# KIM-Ideengenerator

Der KIM-Ideengenerator ist ein KI-basierter Assistent für die Mölders Holding, der verschiedene Agenten unterstützt und mit der ElevenLabs API kommuniziert.

## Features
- Voice Assistant mit mehreren Agenten (z.B. Möldi, Joshua)
- Integration der ElevenLabs API für Sprachfunktionen
- Moderne UI mit Tailwind CSS
- Next.js Framework
- Echtzeit Messaging & Transcript Download

## Installation

1. Repository klonen:
   ```zsh
   git clone https://github.com/larsbertram1976/KIM-Ideengenerator.git
   cd KIM-Ideengenerator
   ```
2. Abhängigkeiten installieren:
   ```zsh
   npm install
   ```
3. Umgebungsvariablen setzen:
   Erstelle eine `.env`-Datei im Projekt-Root und trage die benötigten Keys ein:
   ```env
   ELEVEN_LABS_API_KEY=your_elevenlabs_api_key
   NEXT_PUBLIC_AGENT_ID_MOELDI=your_agent_id
   NEXT_PUBLIC_AGENT_ID_JOSHUA=your_agent_id
   NEXT_PUBLIC_ELEVEN_LABS_API_KEY=your_elevenlabs_api_key
   ```

## Entwicklung starten

```zsh
npm run dev
```

Die App ist dann unter `http://localhost:3000` erreichbar.

## Verzeichnisstruktur
- `app/` – Hauptlogik und Seiten
- `components/` – UI-Komponenten und Voice Assistant
- `lib/` – Hilfsfunktionen
- `public/` – Statische Dateien und Bilder
- `.env` – Umgebungsvariablen

## Lizenz
MIT

---
Für Fragen oder Support: Lars Bertram
