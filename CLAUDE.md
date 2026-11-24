# Reiseblog – Hinweise für Claude

Camper-Reisetagebuch als Web-App (GitHub Pages) und PWA fürs iPhone: Reisen mit Übernachtungen, Fahrten, Ausflügen und Events, Stellplätze mit Bewertung, Fotos auf der Karte, Suche nach Ort und Datum. **Alle Texte in der App und alle Erklärungen auf Deutsch**, einfach und ohne Fachchinesisch. Zielgeräte: iPhone (auch 13 mini, 375 px) und PC (ab 900 px Seitenleiste statt Sheet).

## Technik
- **SvelteKit 3 + Svelte 5 (Runes) + TypeScript**, `adapter-static` als SPA mit **Hash-Router** (`#/reise/…`), Konfiguration komplett in `vite.config.ts` (kein `svelte.config.js`). Seitenoptionen wie `export const ssr` sind beim Hash-Router verboten.
- Importe aus `src/lib` über `#lib/…` **mit Dateiendung** (`#lib/datum.ts`, `#lib/ui/Sheet.svelte`).
- PWA: `@vite-pwa/sveltekit` (`withPwa` in `vite.config.ts`), `registerType: 'prompt'` → `src/lib/ui/NeueVersion.svelte` zeigt „Neue Version – tippen zum Laden“. Auf localhost kein Service Worker. Kartenkacheln werden offline zwischengespeichert (runtimeCaching).
- Karte: MapLibre GL + OpenFreeMap (Positron), eigene Farben in `src/lib/farben.ts`, Umfärben in `src/lib/map/stil.ts`. Der Worker wird über `?worker&url` eingebunden (sonst lädt er nach dem Bündeln nicht).
- Dienste ohne Schlüssel (`src/lib/geo/dienste.ts`): Photon (Ortssuche, Ortsname), OSRM (Straßenroute, vereinfacht auf ≤ 300 Punkte). Nur Suchbegriffe/Koordinaten senden, nie persönliche Daten.
- Fotos (`src/lib/fotos/import.ts`): EXIF (exifr) vor dem Verkleinern lesen, 1600 px JPEG als Blob in IndexedDB (`dateien`), Vorschau 320 px als Data-URL im Datensatz. Zuordnung zu Reise/Tag nach Aufnahmedatum.

## Daten
- Datenmodell im Kopfkommentar von `src/lib/db/typen.ts` (Reise, Eintrag, Platz, Foto; jede mit `id`, `geaendert`, `geloescht`).
- Lokal: Dexie (`src/lib/db/db.ts`). Zentraler reaktiver Speicher `daten` (`src/lib/db/daten.svelte.ts`): **alle Änderungen über `daten.speichern()` / `daten.loeschen()`** – die schreiben IndexedDB und die Outbox (für den späteren Abgleich). Löschen ist weich und gibt eine Rückgängig-Funktion zurück → `ui.zeige(text, rueckgaengig)`.
- Abgeleitete Werte (Nächte, km, Tage, laufende Reise, Plätze in der Nähe) in `src/lib/auswertung.ts`.
- Beispieldaten (`src/lib/beispiel/`): IDs beginnen mit `bsp-`, gehen nicht in die Outbox und dürfen nie hochgeladen werden.
- Abgleich mit Supabase: noch offen (siehe TODO). Eigenes Supabase-Projekt, Wecker-Ablauf gegen das Pausieren.

## Oberfläche
- `src/routes/+layout.svelte`: Karte im Hintergrund, darüber Sheet (iPhone, `src/lib/ui/Sheet.svelte`, drei Höhen) bzw. Seitenleiste (PC). Dialoge laufen über `ui.dialog` (`src/lib/ui.svelte.ts`), Formulare in `src/lib/formulare/`.
- Kartensteuerung über `ui.zeigeReise/zeigeOrt/zeigeAlles` (berücksichtigt Sheet bzw. Leiste). „Ort auf der Karte wählen“: `await ui.ortWaehlen()` – Dialoge bleiben dabei erhalten (nur ausgeblendet).
- Design „Wegweiser“: Werte in `src/lib/styles/design.css` (hell: Waldgrün/Signal-Gelb, dunkel „Asphalt“: Graphit/Creme/Gelb), Grundstile in `grund.css`. Keine Emojis als Icons (Phosphor), keine lila Verläufe, keine Glas-Karten. Dunkelmodus folgt dem Gerät, Wahl unter Einstellungen.
- Eingabefelder mindestens 16 px (sonst zoomt iOS). Bedienung mit einer Hand: Hauptaktion „Hier eintragen“ unten rechts, Erweitertes hinter „Mehr“.
- Achtung: globale Hilfsklassen (`.leer`, `.ueber`, `.knopf`, `.chips`, `.feld` …) nicht für andere Zwecke wiederverwenden.

## Arbeiten und Prüfen
- Node.js ist installiert (`C:\Program Files\nodejs`). In Git Bash ggf. `export PATH="/c/Program Files/nodejs:$PATH"`.
- `npm run dev` (Port 5173, im WLAN erreichbar) · `npm run check` · `npm test` (Vitest) · Build: `BASE_PATH=/reiseblog npm run build` (in Git Bash wird `/reiseblog` umgeschrieben → in PowerShell bauen).
- `node tools/bilder.mjs [handy|pc]` (optional `DUNKEL=1`): spielt die App mit WebKit durch und legt Bildschirmfotos in `tools/bilder/` (nicht im Git). Nach Oberflächen-Änderungen laufen lassen und die Bilder ansehen.
- `node tools/icons.mjs`: PNG-Icons aus `static/icons/icon.svg` neu erzeugen.

## Git und Veröffentlichen
- Repo `Si2Po/reiseblog` (öffentlich), Seite https://si2po.github.io/reiseblog/ – gebaut und veröffentlicht durch `.github/workflows/veroeffentlichen.yml` bei jedem Push auf `main`.
- Lokal auf `main` committen, **erst pushen, wenn es ausdrücklich gewünscht ist** (Push = Veröffentlichung).
- Version in `package.json`; der Service Worker erkennt neue Versionen von selbst.
- Niemals Secret-Keys, `service_role` oder Datenbank-Passwörter einchecken. Der Supabase-Publishable-Key darf in den Code.

## Stand
Offene Punkte und Ideen in `TODO.md`.
