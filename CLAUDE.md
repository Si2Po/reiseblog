# Reiseblog – Hinweise für Claude

Camper-Reisetagebuch als Web-App (GitHub Pages) und PWA fürs iPhone: Reisen mit Übernachtungen, Fahrten und Ausflügen, Stellplätze mit Bewertung, Fotos auf der Karte, Suche nach Ort und Datum. **Alle Texte in der App und alle Erklärungen auf Deutsch**, einfach und ohne Fachchinesisch. Zielgeräte: iPhone (auch 13 mini, 375 px) und PC (ab 900 px Seitenleiste statt Sheet).

## Technik
- **SvelteKit 3 + Svelte 5 (Runes) + TypeScript**, `adapter-static` als SPA mit **Hash-Router** (`#/reise/…`), Konfiguration komplett in `vite.config.ts` (kein `svelte.config.js`). Seitenoptionen wie `export const ssr` sind beim Hash-Router verboten.
- Importe aus `src/lib` über `#lib/…` **mit Dateiendung** (`#lib/datum.ts`, `#lib/ui/Sheet.svelte`).
- PWA: `@vite-pwa/sveltekit` (`withPwa` in `vite.config.ts`), `registerType: 'prompt'` → `src/lib/ui/NeueVersion.svelte` zeigt „Neue Version – tippen zum Laden“. Auf localhost kein Service Worker. Kartenkacheln werden offline zwischengespeichert (runtimeCaching).
- Karte: MapLibre GL + OpenFreeMap (Positron), eigene Farben in `src/lib/farben.ts`, Umfärben in `src/lib/map/stil.ts`. Der Worker wird über `?worker&url` eingebunden (sonst lädt er nach dem Bündeln nicht).
- Dienste ohne Schlüssel: Photon (Ortssuche, Ortsname) und OSRM (Straßenroute, vereinfacht auf ≤ 300 Punkte) in `src/lib/geo/dienste.ts`, Open-Meteo (Wetter, `src/lib/wetter.ts`), Frankfurter/EZB (Wechselkurse, `src/lib/kosten.svelte.ts`). Nur Suchbegriffe/Koordinaten/Datum senden, nie persönliche Daten. Neue Dienste auch in der README nennen.
- Offline: alles wird lokal gespeichert; fehlende Ortsnamen (`ortsnamenNachtragen`) und Straßenrouten (`offeneRoutenNachtragen`) werden beim Start und bei „online“ nachgeholt (`src/lib/geo/routen.ts`).
- Fotos (`src/lib/fotos/import.ts`): EXIF (exifr) vor dem Verkleinern lesen, 1600 px JPEG als Blob in IndexedDB (`dateien`), Vorschau 320 px als Data-URL im Datensatz. Zuordnung zu Reise/Tag nach Aufnahmedatum; mit GPS landet ein Foto beim Ausflug desselben Tages (≤ 15 km und näher als an der Übernachtung, `ausflugBeiFoto`).

## Daten
- Datenmodell im Kopfkommentar von `src/lib/db/typen.ts` (Reise, Eintrag, Platz, Foto, Ziel; jede mit `id`, `geaendert`, `geloescht`).
- **Merkmal-Katalog** `src/lib/merkmale.ts`: alle zusätzlichen, auswertbaren Eigenschaften (Ausstattung, Lage, Untergrund, Kosten, Eindruck …) stehen als `merkmale` (Schlüssel → Wert) an Platz bzw. Eintrag. **Neues Merkmal = eine Zeile im Katalog**, Formulare (`MerkmalFelder.svelte`) und Anzeige entstehen daraus. Schlüssel nie umbenennen. Werte auswertbar speichern (Zahl, ja/nein, fester Auswahl-Schlüssel), Länder zusätzlich als `landCode`.
- Ältere Datensätze bringt `src/lib/db/aufbereiten.ts` beim Laden in die aktuelle Form (z. B. `ausstattung` → `merkmale`, `url` → `links`, Übernachtungs-Text → erste Notiz).
- Übernachtungen: `notizen` mit Zeitpunkt; in der Zeitleiste erscheint jede Nacht (Folgenächte), Notizen vor 12 Uhr zählen zur Nacht davor (`nachtNotizen` in `auswertung.ts`). Fahrten: `via` = Zwischenziele, `viaEinfuegen` setzt neue an die Stelle mit dem kleinsten Umweg.
- Liegt ein Eintrag außerhalb der Reise, wird der Reisezeitraum beim Speichern erweitert. Fotos eines Eintrags stehen direkt beim Eintrag, Fotos außerhalb des Zeitraums unter „Weitere Fotos“.
- Lokal: Dexie (`src/lib/db/db.ts`). Zentraler reaktiver Speicher `daten` (`src/lib/db/daten.svelte.ts`): **alle Änderungen über `daten.speichern()` / `daten.loeschen()`** – die schreiben IndexedDB und die Outbox (für den späteren Abgleich). Löschen ist weich und gibt eine Rückgängig-Funktion zurück → `ui.zeige(text, rueckgaengig)`.
- Abgeleitete Werte (Nächte, km, Tage, laufende Reise, Plätze in der Nähe) in `src/lib/auswertung.ts`.
- **Unterwegs** (`src/lib/unterwegs.ts`): aktuelle Übernachtung, offene Fahrt (`von` ohne `nach`), „Weiterfahren“ setzt die Nächte bis heute und legt eine offene Fahrt an; die nächste Übernachtung schließt sie ab. Neue Übernachtung → Nächte der vorigen werden bis zum neuen Datum ergänzt (`naechteBis`).
- **Ziele/Planung**: Art `ziel` (Name, Art, Ort, Links, Notiz, optional `reise` = geplant für diese Reise, `erledigt`). Seite `#/ziele`, Formular `ZielFormular.svelte`; Reisen in der Zukunft ohne Einträge zeigen zuerst ihre geplanten Ziele. Ziele werden nicht geteilt.
- **Kosten** (`src/lib/kosten.svelte.ts`): `kosten[]` am Eintrag (Art laut `KOSTEN_ART`, Betrag, Währung), Übernachtung = `preis` × Nächte + Merkmale `stromkosten`/`kurtaxe`. Übersicht am Ende der Reise; Summen je Währung, „≈ €“ mit aktuellen EZB-Kursen (1× am Tag, localStorage).
- **Wetter** (`src/lib/wetter.ts`): `wetter[datum]` an dem Eintrag, der den Ort des Tages angibt (Übernachtung dieser Nacht, sonst letzter Eintrag mit Ort). Wird beim Öffnen einer Reise für vergangene Tage still nachgetragen und reist beim Abgleich mit. Beim Bearbeiten eines Eintrags `wetter` behalten.
- **Statistik** (`src/lib/statistik.ts`, Seite `#/statistik`): Länder per Punkt-in-Polygon aus `static/laender.json` (Natural Earth, vereinfacht; Eigenschaften `c` = Ländercode, `n` = Name), Färbung über `ui.laender` auf der Karte. Plätze-Karte färbt nach Bewertung (`src/lib/map/zusatz.ts`), Filter über `ui.sichtbarePlaetze`.
- Beispieldaten (`src/lib/beispiel/`): IDs beginnen mit `bsp-`, gehen nicht in die Outbox und dürfen nie hochgeladen werden.
- **Abgleich** (`src/lib/db/abgleich.svelte.ts`): Supabase-Tabelle `dokumente` (id = lokale UUID, `art` reise/eintrag/platz/foto/ziel, `inhalt` = Datensatz als JSON, weiches Löschen, Server-Zeit `geaendert_am`). Hochladen aus der Outbox per upsert (Fotos vorher in den Eimer `fotos`, Pfad `<user-id>/<foto-id>.jpg`), Abholen mit `geaendert_am > stand`. Konflikte: neueres `geaendert` gewinnt. Ein Konto pro Haushalt (Partnerin meldet sich mit demselben Konto an). Ohne Eintrag in `src/lib/config.ts` ist der Abgleich aus.
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
- `node tools/neu-test.mjs`: Folgenächte/Notizen, Währung, Reisezeitraum, Ort-Wahl mit Suche, langes Drücken (Stecknadel), „Fahrt über hier“, Fotos am Eintrag, Links/Merkmale am Platz.
- `node tools/kosten-test.mjs`: Kosten (Übersicht, Umrechnung, Formular), Wetter, Foto beim passenden Ausflug, Ziele in der Nähe, Eintragen ohne Internet und Nachtragen des Ortsnamens.
- `node tools/planung-test.mjs`: Statistik/Länder, Plätze-Filter, Ziele merken, geplante Reise, Weiterfahren mit automatischen Nächten und offener Fahrt, Stecknadel → Ziel.
- `node tools/abgleich-test.mjs`: Abgleich und Teilen gegen eine nachgebaute Supabase (zwei Geräte + Gast). Braucht einen zweiten Dev-Server: `VITE_TEST_SUPABASE_URL=https://test.supabase.example npx vite dev --port 5174`.
- `node tools/icons.mjs`: PNG-Icons aus `static/icons/icon.svg` neu erzeugen.

## Zusammenarbeit
- Nach größeren Änderungen die App **wie ein Mensch benutzen** (Rundgang mit den Testskripten und gedanklich: vor, während und nach einer Reise, am iPhone und am PC) und dem Nutzer daraus **Vorschläge für nette oder erwartbare Funktionen** machen – kurz, priorisiert, ohne sie ungefragt zu bauen.

## Git und Veröffentlichen
- Repo `Si2Po/reiseblog` (öffentlich), Seite https://si2po.github.io/reiseblog/ – gebaut und veröffentlicht durch `.github/workflows/veroeffentlichen.yml` bei jedem Push auf `main`.
- Lokal auf `main` committen, **erst pushen, wenn es ausdrücklich gewünscht ist** (Push = Veröffentlichung).
- Version in `package.json`; der Service Worker erkennt neue Versionen von selbst.
- Niemals Secret-Keys, `service_role` oder Datenbank-Passwörter einchecken. Der Supabase-Publishable-Key darf in den Code.

## Stand
Offene Punkte und Ideen in `TODO.md`.
