// Rundgang wie ein neuer Nutzer: leerer Start, alle Seiten, eigene Reise, Dialoge, Beispieldaten, dunkel, PC.
// Legt Bildschirmfotos in tools/bilder/rundgang-*.png und listet Fehler aus der Konsole.
// Aufruf: node tools/rundgang.mjs   (Dev-Server auf :5173)
import { webkit } from 'playwright';
const BASIS = process.env.URL ?? 'http://localhost:5173/';
const b = await webkit.launch();
const fehler = [];
async function geraet(opt, name) {
	const ctx = await b.newContext({ locale: 'de-DE', geolocation: { latitude: 59.9139, longitude: 10.7522, accuracy: 10 }, permissions: ['geolocation'], ...opt });
	const p = await ctx.newPage();
	p.on('pageerror', (e) => !/access control checks/.test(e.message) && fehler.push(`${name}: ${e.message}`));
	p.on('console', (m) => m.type() === 'error' && !/access control|Failed to load|Load failed|network connection/i.test(m.text()) && fehler.push(`${name}: ${m.text()}`));
	return p;
}
const handy = await geraet({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 }, 'Handy');
const w = (p, ms) => p.waitForTimeout(ms);
const foto = (p, n) => p.screenshot({ path: `tools/bilder/rundgang-${n}.png` });
async function voll(p) {
	await p.locator('.griff').click();
	await w(p, 250);
	if (!(await p.locator('.inhalt.scrollt').count())) await p.locator('.griff').click();
	await w(p, 450);
}
const p = handy;

// 1. Leerer Start und leere Seiten
await p.goto(BASIS);
await w(p, 2500);
await foto(p, '01-start-leer');
for (const [hash, n] of [['#/plaetze', '02-plaetze-leer'], ['#/ziele', '03-ziele-leer'], ['#/fotos', '04-fotos-leer'], ['#/suche', '05-suche-leer'], ['#/statistik', '06-statistik-leer'], ['#/einstellungen', '07-einstellungen']]) {
	await p.goto(BASIS + hash);
	await w(p, 1200);
	await voll(p);
	await foto(p, n);
}

// 2. Eigene Reise mit langem Namen, ohne Enddatum
await p.goto(BASIS);
await w(p, 1200);
await p.getByRole('button', { name: 'Neue Reise' }).first().click();
await w(p, 500);
await foto(p, '08-neue-reise');
await p.locator('input[placeholder^="z. B. Norwegen"]').fill('Große Skandinavien-Rundreise mit Freunden und Hund');
await p.getByRole('button', { name: 'Anlegen' }).click();
await w(p, 1500);
await foto(p, '09-reise-leer');

// 3. Hier eintragen (Oslo) → Übernachtung, Formular ganz ansehen
await p.locator('button.hier').click();
await w(p, 4000);
await foto(p, '10-hier-eintragen');
await p.getByRole('button', { name: 'Übernachtung' }).click();
await w(p, 800);
await foto(p, '11-formular-oben');
await p.locator('.dialog .inhalt').evaluate((e) => e.scrollTo(0, e.scrollHeight));
await w(p, 400);
await foto(p, '12-formular-unten');
await p.getByRole('button', { name: 'Eintragen' }).click();
await w(p, 1500);
await voll(p);
await foto(p, '13-reise-mit-eintrag');

// 4. Startseite mit eigener Reise, dann Beispieldaten
await p.goto(BASIS);
await w(p, 1200);
await foto(p, '14-start-eine-reise');
await p.goto(BASIS + '#/einstellungen');
await w(p, 1000);
await voll(p);
await p.getByRole('button', { name: 'Beispielreisen laden' }).click();
await w(p, 1500);
for (const [hash, n] of [['#/statistik', '15-statistik'], ['#/plaetze', '16-plaetze'], ['#/platz/bsp-p4', '17-platz'], ['#/ziele', '18-ziele'], ['#/reise/bsp-sc27', '19-geplante-reise']]) {
	await p.goto(BASIS + hash);
	await w(p, 1500);
	await foto(p, n);
}
// Suche ohne Treffer
await p.goto(BASIS + '#/suche');
await w(p, 1000);
await p.locator('input[type=search]').fill('xyzzy');
await w(p, 600);
await foto(p, '20-suche-ohne-treffer');

// 5. Dunkel
const dunkel = await geraet({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, colorScheme: 'dark' }, 'Dunkel');
await dunkel.goto(BASIS);
await w(dunkel, 2500);
await dunkel.getByText('Beispielreisen laden').click();
await w(dunkel, 1500);
await dunkel.goto(BASIS + '#/reise/bsp-no25');
await w(dunkel, 1500);
await voll(dunkel);
await dunkel.screenshot({ path: 'tools/bilder/rundgang-21-dunkel-reise.png' });
await dunkel.goto(BASIS + '#/fotos');
await w(dunkel, 1500);
await dunkel.screenshot({ path: 'tools/bilder/rundgang-22-dunkel-fotos.png' });

// 6. PC
const pc = await geraet({ viewport: { width: 1280, height: 800 } }, 'PC');
await pc.goto(BASIS);
await w(pc, 2500);
await pc.getByText('Beispielreisen laden').click();
await w(pc, 1500);
await pc.screenshot({ path: 'tools/bilder/rundgang-23-pc-start.png' });
await pc.goto(BASIS + '#/reise/bsp-no25');
await w(pc, 1800);
await pc.screenshot({ path: 'tools/bilder/rundgang-24-pc-reise.png' });
await pc.goto(BASIS + '#/statistik');
await w(pc, 1800);
await pc.screenshot({ path: 'tools/bilder/rundgang-25-pc-statistik.png' });

await b.close();
console.log(fehler.length ? 'FEHLER:\n' + [...new Set(fehler)].join('\n') : 'Keine Fehler in der Konsole.');
