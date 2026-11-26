// Test: Reise als PDF (Dialog, Auswahl, Erstellen, Herunterladen), Sicherung mit Passwort, Fotoalbum.
// Aufruf: node tools/pdf-test.mjs   (Dev-Server auf :5173)
import { webkit } from 'playwright';
const BASIS = process.env.URL ?? 'http://localhost:5173/';
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'de-DE', acceptDownloads: true });
const p = await ctx.newPage();
const fehler = [];
// Kartenkacheln, die WebKit im Test wegen CORS ablehnt, sind kein App-Fehler
p.on('pageerror', (e) => !/access control checks/.test(e.message) && fehler.push(e.message));
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
await p.getByRole('button', { name: 'Herunterladen' }).waitFor({ timeout: 60000 }).catch(async () => { await p.screenshot({ path: 'tools/bilder/pdf-haengt.png' }); console.log('Fehler bisher:', fehler); process.exit(1); });
await p.screenshot({ path: 'tools/bilder/pdf-fertig.png' });
const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Herunterladen' }).click()]);
const ziel = process.env.PDF ?? 'tools/bilder/reise.pdf';
await dl.saveAs(ziel);
const fs = await import('node:fs');
const roh = fs.readFileSync(ziel);
ok(roh.subarray(0, 5).toString() === '%PDF-', `PDF heruntergeladen (${Math.round(roh.length / 1024)} KB, ${dl.suggestedFilename()})`);

// Fotoalbum: alle Fotos, Großansicht, „Zur Reise“
await p.goto(BASIS + '#/fotos');
await warte(1500);
const anzahl = await p.locator('.raster button').count();
ok(anzahl === 21, `Fotoalbum zeigt alle Beispielfotos (${anzahl})`);
await klick(p.locator('.raster button').first());
await warte(600);
await p.getByRole('button', { name: 'Zur Reise' }).click();
await warte(1200);
ok(p.url().includes('#/reise/') && !(await p.locator('.gross').count()), 'Aus dem Album zur Reise gesprungen');

// Foto ohne Ort und ohne Reise hinzufügen → Filter „Ohne Ort“ → auswählen → auf der Karte platzieren
await p.goto(BASIS + '#/fotos');
await warte(1200);
const bild = await p.evaluate(() => {
	const c = document.createElement('canvas');
	c.width = 800;
	c.height = 600;
	const g = c.getContext('2d');
	g.fillStyle = '#3f6f80';
	g.fillRect(0, 0, 800, 600);
	return c.toDataURL('image/jpeg', 0.9).split(',')[1];
});
const [wahl] = await Promise.all([p.waitForEvent('filechooser'), klick(p.getByLabel('Fotos hinzufügen'))]);
await wahl.setFiles({ name: 'ohne-ort.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bild, 'base64') });
await warte(3000);
const filter = p.getByRole('radio', { name: /Ohne Ort/ });
ok((await filter.count()) === 1, 'Filter „Ohne Ort“ erscheint');
await klick(filter);
await warte(400);
ok((await p.locator('.raster button').count()) === 1, 'Filter zeigt nur das Foto ohne Ort');
await klick(p.getByRole('button', { name: 'Auswählen' }));
await klick(p.locator('.raster button').first());
await warte(300);
await p.screenshot({ path: 'tools/bilder/album-auswahl.png' });
await klick(p.getByRole('button', { name: 'Platzieren' }));
await warte(800);
await p.getByRole('button', { name: 'Übernehmen' }).click();
await warte(1200);
ok((await p.getByRole('radio', { name: /Ohne Ort/ }).count()) === 0, 'Nach dem Platzieren hat das Foto einen Ort (Filter weg)');

// Datum in der Großansicht ändern: Foto ohne Reise bekommt ein Datum in Norwegen → wandert dorthin
const norwegenVorher = await p.locator('.seite > section', { hasText: 'Norwegen' }).locator('.raster button').count();
await klick(p.locator('.seite > section', { hasText: 'Ohne Reise' }).locator('.raster button').first());
await warte(600);
await p.getByRole('button', { name: 'Aufnahmezeit ändern' }).click();
await p.locator('.datum input').fill('2025-07-08T12:30');
await p.getByRole('button', { name: 'Speichern' }).click();
await warte(800);
await p.screenshot({ path: 'tools/bilder/datum-geaendert.png' });
ok((await p.locator('.gross').innerText()).includes('Di, 8. Juli 2025'), 'Großansicht zeigt das neue Datum');
await p.keyboard.press('Escape');
await warte(500);
const norwegenNachher = await p.locator('.seite > section', { hasText: 'Norwegen' }).locator('.raster button').count();
ok(norwegenNachher === norwegenVorher + 1, 'Foto ist mit dem neuen Datum zur Reise Norwegen gewandert');

// Foto zuordnen: über den Titel in der Großansicht einem Ausflug zuordnen
await klick(p.locator('.seite > section', { hasText: 'Norwegen' }).locator('.raster button').first());
await warte(600);
await p.getByRole('button', { name: 'Foto zuordnen' }).click();
await warte(700);
await p.screenshot({ path: 'tools/bilder/zuordnen.png' });
ok((await p.locator('.dialog .marke', { hasText: 'Aufnahmetag' }).count()) >= 1, 'Zuordnen: Aufnahmetag ist markiert');
await p.locator('.dialog .zeile', { hasText: 'Trolltunga' }).click();
await p.locator('.dialog').getByRole('button', { name: 'Zuordnen' }).click();
await warte(800);
await p.goto(BASIS + '#/reise/bsp-no25');
await warte(1500);
ok((await p.locator('.ein', { hasText: 'Trolltunga' }).locator('.beim-eintrag img').count()) === 1, 'Foto steht jetzt beim Ausflug „Trolltunga“');
await p.goto(BASIS + '#/fotos');
await warte(1200);

// Sicherung mit Passwort
await p.goto(BASIS + '#/einstellungen');
await warte(1200);
await klick(p.getByText('Als Datei sichern'));
await p.getByLabel('Passwort für die Sicherung').fill('geheim123');
await p.getByLabel('Noch einmal').fill('geheim123');
await p.getByLabel('Noch einmal').press('Enter');
await p.getByRole('button', { name: 'Herunterladen' }).waitFor({ timeout: 20000 });
const [sd] = await Promise.all([p.waitForEvent('download'), klick(p.getByRole('button', { name: 'Herunterladen' }))]);
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
await p.getByLabel('Passwort der Sicherung').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
ok((await p.getByLabel('Passwort der Sicherung').count()) === 0 && (await p.locator('.fehler').count()) === 0, 'Mit richtigem Passwort eingelesen (Formular zu, kein Fehler)');

console.log(fehler.length ? '\nFEHLER:\n' + fehler.join('\n') : '\nAlles gut.');
await b.close();
process.exit(fehler.length ? 1 : 0);
