// Test: Reise als PDF (Dialog, Auswahl, Erstellen, Herunterladen), Sicherung mit Passwort.
// Aufruf: node tools/pdf-test.mjs   (Dev-Server auf :5173)
import { webkit } from 'playwright';
const BASIS = process.env.URL ?? 'http://localhost:5173/';
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'de-DE', acceptDownloads: true });
const p = await ctx.newPage();
const fehler = [];
p.on('pageerror', (e) => fehler.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/access control|Failed to load|Load failed|network connection/i.test(m.text()) && fehler.push(m.text()));
const ok = (bed, text) => (console.log((bed ? '✓ ' : '✗ ') + text), bed || fehler.push('Prüfung: ' + text));
const warte = (ms) => p.waitForTimeout(ms);
// Knöpfe im Sheet können unterhalb des sichtbaren Bereichs liegen: direkt auslösen
const klick = (l) => l.evaluate((e) => e.click());

await p.goto(BASIS);
await warte(2500);
await p.getByText('Beispielreisen laden').click();
await warte(1500);
await p.locator('a.reise').nth(1).click();
await warte(1500);
await p.getByLabel('Als PDF').click();
await warte(600);
await p.screenshot({ path: 'tools/bilder/pdf-dialog.png' });
ok(await p.getByText('PDF erstellen').isVisible(), 'PDF-Dialog offen');
const kosten = p.locator('label.schalter', { hasText: 'Kosten' }).locator('input');
ok(!(await kosten.isChecked()), 'Kosten sind standardmäßig aus');
await kosten.check();
await p.getByText('PDF erstellen').click();
await p.getByRole('button', { name: 'Teilen' }).waitFor({ timeout: 60000 }).catch(async () => { await p.screenshot({ path: 'tools/bilder/pdf-haengt.png' }); console.log('Fehler bisher:', fehler); process.exit(1); });
await p.screenshot({ path: 'tools/bilder/pdf-fertig.png' });
const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Teilen' }).click()]);
const ziel = process.env.PDF ?? 'tools/bilder/reise.pdf';
await dl.saveAs(ziel);
const fs = await import('node:fs');
const roh = fs.readFileSync(ziel);
ok(roh.subarray(0, 5).toString() === '%PDF-', `PDF heruntergeladen (${Math.round(roh.length / 1024)} KB, ${dl.suggestedFilename()})`);

// Sicherung mit Passwort
await p.goto(BASIS + '#/einstellungen');
await warte(1200);
await klick(p.getByText('Als Datei sichern'));
await p.getByLabel('Passwort für die Sicherung').fill('geheim123');
await p.getByLabel('Noch einmal').fill('geheim123');
await p.getByLabel('Noch einmal').press('Enter');
await p.getByRole('button', { name: 'Datei sichern' }).waitFor({ timeout: 20000 });
const [sd] = await Promise.all([p.waitForEvent('download'), klick(p.getByRole('button', { name: 'Datei sichern' }))]);
const sPfad = 'tools/bilder/sicherung.json';
await sd.saveAs(sPfad);
const sicherung = fs.readFileSync(sPfad, 'utf8');
const json = JSON.parse(sicherung);
ok(json.version === 2 && json.tresor?.d && !json.reisen, 'Sicherung ist verschlüsselt');
ok(!/Schottland|Norwegen|Therme/i.test(sicherung), 'Kein Reisename lesbar in der Sicherung');

// Einlesen: falsches, dann richtiges Passwort
await p.locator('input[type=file]').setInputFiles(sPfad);
await warte(400);
await p.getByLabel('Passwort der Sicherung').fill('falsch12');
await p.getByLabel('Passwort der Sicherung').press('Enter');
await warte(2500);
ok(await p.getByText('Das Passwort passt nicht').isVisible(), 'Falsches Passwort wird abgelehnt');
await p.getByLabel('Passwort der Sicherung').fill('geheim123');
await p.getByLabel('Passwort der Sicherung').press('Enter');
await warte(2500);
ok(await p.getByText(/Datensätze? eingelesen/).isVisible(), 'Mit richtigem Passwort eingelesen');

console.log(fehler.length ? '\nFEHLER:\n' + fehler.join('\n') : '\nAlles gut.');
await b.close();
process.exit(fehler.length ? 1 : 0);
