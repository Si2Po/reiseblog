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
- **Abgleich** (`src/lib/db/abgleich.svelte.ts`): Supabase-Tabelle `dokumente` (id = lokale UUID, `art` reise/eintrag/platz/foto, `inhalt` = Datensatz als JSON, weiches Löschen, Server-Zeit `geaendert_am`). Hochladen aus der Outbox per upsert (Fotos vorher in den Eimer `fotos`, Pfad `<user-id>/<foto-id>.jpg`), Abholen mit `geaendert_am > stand`. Konflikte: neueres `geaendert` gewinnt. Ein Konto pro Haushalt (Partnerin meldet sich mit demselben Konto an). Ohne Eintrag in `src/lib/config.ts` ist der Abgleich aus.
- **Teilen**: Tabelle `freigaben` (token, name, umfang), Gast-Ansicht `#/teilen/<token>` lädt über RPC `freigabe_lesen` nur Freigegebenes; der Server entfernt nicht freigegebene Felder. Gast-Daten liegen nur im Speicher (`daten.gast`), Bearbeiten ist ausgeblendet.
- **Datenbank**: `supabase/komplett.sql` = ganzer Stand für neue Projekte; jede Schema-Änderung zusätzlich als kleine Datei in `supabase/schritte/` und Zeile in der Tabelle von `supabase/ANLEITUNG.md`. Wecker `.github/workflows/wecker.yml` liest URL und Schlüssel aus `config.ts` (Format der beiden Zeilen beibehalten).

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
- `node tools/ablauf.mjs`: Funktionstest der Hauptabläufe (Reise, Hier eintragen, automatische Fahrt mit Route, Foto, Löschen/Rückgängig).
- `node tools/abgleich-test.mjs`: Abgleich und Teilen gegen eine nachgebaute Supabase (zwei Geräte + Gast). Braucht einen zweiten Dev-Server: `VITE_TEST_SUPABASE_URL=https://test.supabase.example npx vite dev --port 5174`.
- `node tools/icons.mjs`: PNG-Icons aus `static/icons/icon.svg` neu erzeugen.

## Git und Veröffentlichen
- Repo `Si2Po/reiseblog` (öffentlich), Seite https://si2po.github.io/reiseblog/ – gebaut und veröffentlicht durch `.github/workflows/veroeffentlichen.yml` bei jedem Push auf `main`.
- Lokal auf `main` committen, **erst pushen, wenn es ausdrücklich gewünscht ist** (Push = Veröffentlichung).
- Version in `package.json`; der Service Worker erkennt neue Versionen von selbst.
- Niemals Secret-Keys, `service_role` oder Datenbank-Passwörter einchecken. Der Supabase-Publishable-Key darf in den Code.

## Stand
Offene Punkte und Ideen in `TODO.md`.
