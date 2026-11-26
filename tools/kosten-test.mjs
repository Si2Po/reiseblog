// Test: Kosten, Wetter, Ziele in der Nähe, Fotos beim passenden Ausflug, Eintragen ohne Netz.
// Aufruf: node tools/kosten-test.mjs   (Dev-Server auf :5173)
import { webkit } from 'playwright';
import { format, addDays } from 'date-fns';

const BASIS = process.env.URL ?? 'http://localhost:5173/';
const b = await webkit.launch();
const ctx = await b.newContext({
	viewport: { width: 375, height: 812 },
	deviceScaleFactor: 2,
	locale: 'de-DE'
});
const p = await ctx.newPage();
const fehler = [];
p.on('requestfailed', (r) => process.env.DBG && console.log('  [fehlgeschlagen]', r.url().slice(0, 120)));
p.on('pageerror', (e) => fehler.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/access control|Failed to load|Load failed|network connection/i.test(m.text()) && fehler.push(m.text()));
const ok = (bed, text) => (console.log((bed ? '✓ ' : '✗ ') + text), bed || fehler.push('Prüfung: ' + text));
const foto = (n) => p.screenshot({ path: `tools/bilder/kosten-${n}.png` });
const warte = (ms) => p.waitForTimeout(ms);
async function voll() {
	await p.locator('.griff').click();
	await warte(250);
	if (!(await p.locator('.inhalt.scrollt').count())) await p.locator('.griff').click();
	await warte(450);
}

await p.goto(BASIS);
await warte(2500);
await p.getByText('Beispielreisen laden').click();
await warte(1200);

// --- Kosten und Wetter in der Norwegen-Reise ---
await p.goto(BASIS + '#/reise/bsp-no25');
await warte(1500);
await voll();
const kosten = await p.locator('.kosten').innerText();
ok(/Übernachtungen/.test(kosten) && /Fähre/.test(kosten) && /Tanken/.test(kosten), 'Kostenübersicht mit Übernachtungen, Tanken, Fähre');
ok(/NOK/.test(kosten), 'Beträge in NOK');
// Wechselkurse + Wetter kommen aus dem Netz
await warte(6000);
const kosten2 = await p.locator('.kosten').innerText();
ok(/≈ [\d.]+ €/.test(kosten2) && /pro Nacht/.test(kosten2), `Umgerechnet: ${kosten2.split('\n').slice(-2).join(' | ')}`);
const wetter = await p.locator('.tagkopf .wetter').count();
ok(wetter >= 8, `Wetter an ${wetter} Tagen`);
ok((await p.locator('.typ-drive .ein-meta', { hasText: 'Fähre' }).count()) === 1, 'Fähre steht an der Fahrt');
await p.locator('.kosten').scrollIntoViewIfNeeded();
await foto('1-norwegen');
await p.locator('.tagkopf').first().scrollIntoViewIfNeeded();
await foto('2-wetter');

// --- Ausgabe im Formular eintragen ---
await p.locator('.typ-outing .ein-knopf', { hasText: 'Dalsnibba' }).click();
await warte(400);
await p.locator('.aktionen').getByLabel('Mehr').click();
await p.waitForTimeout(300);
await p.getByRole('menuitem', { name: 'Details', exact: true }).click();
await warte(500);
await p.getByRole('button', { name: /Eintritt, Essen/ }).click();
await warte(200);
await p.locator('.kosten-zeile input').fill('150');
await p.locator('.kosten-zeile select').last().selectOption('NOK');
await foto('3-formular');
await p.getByRole('button', { name: 'Speichern' }).click();
await warte(800);
ok((await p.locator('.typ-outing .ein-meta', { hasText: 'Eintritt 150 NOK' }).count()) === 1, 'Neue Ausgabe steht am Ausflug');
ok((await p.locator('.kosten').innerText()).includes('Eintritt'), 'und in der Kostenübersicht');

// --- Foto beim passenden Ausflug ---
const zu = await p.evaluate(async () => {
	const m = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/lib/fotos/import.ts')) ?? '/src/lib/fotos/import.ts');
	return [
		m.ausflugBeiFoto('bsp-no25', '2025-07-08', { lat: 58.986, lng: 6.19 })?.titel, // am Preikestolen
		m.ausflugBeiFoto('bsp-no25', '2025-07-08', { lat: 59.0, lng: 6.05 })?.titel ?? null, // am Platz in Jørpeland
		m.ausflugBeiFoto('bsp-no25', '2025-07-09', { lat: 58.986, lng: 6.19 })?.titel ?? null // anderer Tag
	];
});
ok(zu[0] === 'Wanderung Preikestolen' && zu[1] === null && zu[2] === null, `Foto-Zuordnung: ${JSON.stringify(zu)}`);

// --- Ziele in der Nähe während einer Reise ---
await p.goto(BASIS + '#/');
await warte(800);
await voll();
await p.locator('.neue-reise').click();
await p.locator('input[placeholder^="z. B. Norwegen"]').fill('Bodensee');
await p.locator('input[type="date"]').first().fill(format(addDays(new Date(), -1), 'yyyy-MM-dd'));
await p.getByRole('button', { name: 'Anlegen' }).click();
await warte(1000);
await voll();
await p.locator('button.knopf.neu').click();
await warte(500);
await p.locator('input[placeholder="Ort suchen"]').fill('Überlingen');
await p.waitForSelector('.vorschlaege button', { timeout: 10000 });
await p.locator('.vorschlaege button').first().click();
await warte(600);
await p.locator('input[type="date"]').first().fill(format(addDays(new Date(), -1), 'yyyy-MM-dd'));
await p.getByRole('button', { name: 'Eintragen' }).click();
await warte(1200);
// Ziel in 10 km Entfernung merken
await p.evaluate(async () => {
	const { daten } = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/lib/db/daten.svelte.ts')) ?? '/src/lib/db/daten.svelte.ts');
	await daten.speichern('ziele', { name: 'Insel Mainau', art: 'sehenswert', ort: { lat: 47.705, lng: 9.194, name: 'Konstanz' }, links: [] });
	await daten.speichern('ziele', { name: 'Weit weg', art: 'stadt', ort: { lat: 52.52, lng: 13.4, name: 'Berlin' }, links: [] });
});
// (eigene Modul-Kopie im Test → neu laden, damit die App die Ziele sieht)
await p.reload();
await warte(2000);
await voll();
const nahe = await p.locator('.nahe').innerText().catch(() => '');
ok(nahe.includes('Insel Mainau') && /\d+ km/.test(nahe) && !nahe.includes('Weit weg'), `In der Nähe: ${nahe.replaceAll('\n', ' | ')}`);
await foto('4-nahe');
await p.goto(BASIS + '#/ziele');
await warte(1200);
await voll();
ok((await p.locator('h4', { hasText: 'In der Nähe' }).count()) === 1, 'Ziele-Seite: Abschnitt „In der Nähe“');

// --- Ohne Netz eintragen ---
// Internet weg (Ortssuche, Route, Wetter), nur der lokale Dev-Server bleibt erreichbar
await p.evaluate(() => (location.hash = '#/'));
await warte(800);
await ctx.route((u) => !/^(localhost|127.0.0.1)$/.test(u.hostname), (r) => r.abort('internetdisconnected'));
await p.evaluate(() => {
	Object.defineProperty(navigator, 'onLine', { get: () => !window.__offline, configurable: true });
	window.__offline = true;
	window.dispatchEvent(new Event('offline'));
});
await warte(300);
await ctx.grantPermissions(['geolocation']);
await ctx.setGeolocation({ latitude: 47.694, longitude: 9.272, accuracy: 10 });
await p.locator('button.hier').click();
await warte(2500);
await foto('5-offline-hier');
await p.getByRole('button', { name: 'Ausflug' }).click();
await warte(800);
await p.getByRole('button', { name: 'Eintragen' }).click();
await warte(1200);
await voll();
ok((await p.locator('.typ-outing').count()) === 1, 'Ausflug ohne Netz eingetragen');
await foto('6-offline-eingetragen');
await ctx.unrouteAll();
await p.evaluate(() => {
	window.__offline = false;
	window.dispatchEvent(new Event('online'));
});
await warte(5000);
const titel = await p.locator('.typ-outing .ein-titel').innerText();
ok(titel !== 'Ausflug', `Wieder online: Titel nachgetragen („${titel}“)`);

await b.close();
console.log(fehler.length ? 'FEHLER:\n' + [...new Set(fehler)].join('\n') : 'Alles in Ordnung');
