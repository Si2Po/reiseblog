// Funktionstest der wichtigsten Abläufe (WebKit, iPhone-Größe). Aufruf: node tools/ablauf.mjs
import { webkit } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASIS = process.env.URL ?? 'http://localhost:5173/';
mkdirSync('tools/bilder', { recursive: true });
const b = await webkit.launch();
const ctx = await b.newContext({
	viewport: { width: 375, height: 812 },
	deviceScaleFactor: 2,
	geolocation: { latitude: 62.1009, longitude: 7.2061, accuracy: 10 },
	permissions: ['geolocation'],
	locale: 'de-DE'
});
const p = await ctx.newPage();
const fehler = [];
p.on('pageerror', (e) => fehler.push(e.message));
p.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
const ok = (bed, text) => console.log((bed ? '✓ ' : '✗ ') + text) || (!bed && fehler.push('Prüfung: ' + text));
const foto = (n) => p.screenshot({ path: `tools/bilder/ablauf-${n}.png` });
const voll = async () => {
	await p.locator('.griff').click();
	await p.waitForTimeout(250);
	if (!(await p.locator('.inhalt.scrollt').count())) await p.locator('.griff').click();
	await p.waitForTimeout(500);
};
p.on('console', (m) => m.type() !== 'error' && /Foto|foto/.test(m.text()) && console.log('  [Konsole] ' + m.text()));

await p.goto(BASIS);
await p.waitForTimeout(2500);

// 1. Reise anlegen
await p.getByRole('button', { name: 'Neue Reise' }).first().click();
await p.locator('input[placeholder^="z. B. Norwegen"]').fill('Fjordtour');
await p.getByRole('button', { name: 'Anlegen' }).click();
await p.waitForTimeout(1200);
ok(p.url().includes('#/reise/'), 'Reise angelegt und geöffnet');

// 2. Hier eintragen → Übernachtung in Geiranger
await p.locator('button.hier').click();
await p.waitForSelector('text=Geiranger', { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Übernachtung' }).click();
await p.waitForTimeout(600);
await p.locator('input[placeholder="0 = gratis"]').fill('35');
await p.getByRole('radio', { name: '4 Sterne' }).click();
await foto('1-formular');
await p.getByRole('button', { name: 'Eintragen' }).click();
await p.waitForTimeout(1200);
ok((await p.locator('.typ-stay').count()) === 1, 'Übernachtung 1 eingetragen');

// 3. Zweite Übernachtung in Ålesund über die Ortssuche (WebKit übernimmt geänderte Standorte im Test nicht)
await voll();
await p.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
await p.waitForTimeout(600);
await p.locator('input[placeholder="Ort suchen"]').fill('Ålesund');
await p.waitForSelector('.vorschlaege button', { timeout: 10000 });
console.log('  Erster Vorschlag: ' + (await p.locator('.vorschlaege button').first().innerText()).replaceAll('\n', ' | '));
await p.locator('.vorschlaege button').first().click();
await p.waitForTimeout(500);
const fahrtSchalter = p.getByText('Fahrt vom letzten Platz eintragen');
ok((await fahrtSchalter.count()) === 1, 'Fahrt vom letzten Platz wird angeboten');
await p.getByRole('button', { name: 'Eintragen' }).click();
await p.waitForTimeout(6000); // Route rechnen lassen
const fahrt = p.locator('.typ-drive .ein-meta');
const fahrtText = (await fahrt.count()) ? await fahrt.first().innerText() : '';
ok(/km/.test(fahrtText), `Fahrt mit Straßenroute: „${fahrtText.trim()}“`);
await foto('2-zeitleiste');

// 4. Foto hinzufügen (ohne GPS → Ort vom Eintrag)
await voll();
const bild = await p.evaluate(async () => {
	const c = document.createElement('canvas');
	c.width = 1200; c.height = 800;
	const g = c.getContext('2d');
	const v = g.createLinearGradient(0, 0, 0, 800); v.addColorStop(0, '#8fb8cf'); v.addColorStop(1, '#2f4a3c');
	g.fillStyle = v; g.fillRect(0, 0, 1200, 800);
	return c.toDataURL('image/jpeg', 0.9).split(',')[1];
});
const [wahl] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.fotos-leer, .streifen .mehr').first().click()]);
await wahl.setFiles({ name: 'test.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bild, 'base64') });
await p.waitForTimeout(4000);
const hinweis = await p.locator('.hinweis').allInnerTexts();
ok((await p.locator('.streifen img').count()) === 1, 'Foto hinzugefügt ' + hinweis.join(' | '));

// 5. Eintrag löschen und rückgängig
await voll();
const vorher = await p.locator('.ein').count();
await p.locator('.typ-stay .ein-knopf').first().click();
await p.waitForTimeout(400);
await p.locator('.aktionen').getByLabel('Mehr').click();
await p.waitForTimeout(300);
await p.getByRole('menuitem', { name: 'Löschen', exact: true }).click();
await p.waitForTimeout(600);
ok((await p.locator('.ein').count()) === vorher - 1, 'Eintrag gelöscht');
await p.getByRole('button', { name: 'Rückgängig' }).click();
await p.waitForTimeout(800);
ok((await p.locator('.ein').count()) === vorher, 'Löschen rückgängig gemacht');

// 6. Neu laden: Daten bleiben (IndexedDB)
await p.reload();
await p.waitForTimeout(2500);
ok((await p.locator('.ein').count()) === vorher, 'Daten nach Neuladen noch da');

// 7. Plätze: beide neuen Plätze vorhanden
await p.goto(BASIS + '#/plaetze');
await p.waitForTimeout(800);
ok((await p.locator('.plaetze a').count()) === 2, 'Zwei Plätze angelegt');
await foto('3-plaetze');

await b.close();
console.log(fehler.length ? 'FEHLER:\n' + [...new Set(fehler)].join('\n') : 'Alles in Ordnung');
