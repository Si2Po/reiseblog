// Test: Statistik/Weltkarte, Plätze-Karte+Filter, Ziele/Planung, Weiterfahren, Nächte automatisch.
// Aufruf: node tools/planung-test.mjs   (Dev-Server auf :5173)
import { webkit } from 'playwright';
import { format, addDays } from 'date-fns';

const BASIS = process.env.URL ?? 'http://localhost:5173/';
const b = await webkit.launch();
const ctx = await b.newContext({
	viewport: { width: 375, height: 812 },
	deviceScaleFactor: 2,
	geolocation: { latitude: 47.796, longitude: 9.097, accuracy: 10 },
	permissions: ['geolocation'],
	locale: 'de-DE'
});
const p = await ctx.newPage();
const fehler = [];
p.on('pageerror', (e) => fehler.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/access control|Failed to load/.test(m.text()) && fehler.push(m.text()));
const ok = (bed, text) => (console.log((bed ? '✓ ' : '✗ ') + text), bed || fehler.push('Prüfung: ' + text));
const foto = (n) => p.screenshot({ path: `tools/bilder/plan-${n}.png` });
const warte = (ms) => p.waitForTimeout(ms);
async function voll() {
	await p.locator('.griff').click();
	await warte(250);
	if (!(await p.locator('.inhalt.scrollt').count())) await p.locator('.griff').click();
	await warte(450);
}
const heute = format(new Date(), 'yyyy-MM-dd');

await p.goto(BASIS);
await warte(2500);
await p.getByText('Beispielreisen laden').click();
await warte(1200);
ok(await p.getByText('Geplant · 2027').waitFor({ timeout: 8000 }).then(() => true, () => false), 'Geplante Reise ist als „Geplant“ markiert');

// --- Statistik ---
await p.locator('a.summe').click();
await warte(4000);
const laender = await p.locator('.kacheln .gelb b').innerText();
ok(laender.trim() === '3', `Statistik: ${laender} Länder (Norwegen, Frankreich, Italien)`);
ok((await p.locator('.balken li').first().innerText()).includes('Frankreich'), 'Länderliste beginnt mit Frankreich (14 Nächte vor Norwegen mit 13)');
ok((await p.locator('.rekorde li').count()) >= 3, `Rekorde: ${await p.locator('.rekorde li').count()}`);
await foto('1-statistik');
// Jahr antippen: nur dieses Jahr
await p.locator('.jahre button', { hasText: '2025' }).click();
await warte(600);
const kachel = await p.locator('.kacheln').innerText();
ok(/\b1\s+Reise\b/.test(kachel) && (await p.locator('.balken:not(.jahre) li').count()) === 1, 'Statistik nur 2025: 1 Reise, 1 Land (' + kachel.replace(/\s+/g, ' ') + ')');
await foto('1b-statistik-2025');
await p.getByRole('button', { name: 'Alle Jahre zeigen' }).click();
await warte(400);
ok((await p.locator('.balken:not(.jahre) li').count()) === 3, 'Alle Jahre wieder: 3 Länder');

// --- Plätze: Karte + Filter ---
await p.goto(BASIS + '#/plaetze');
await warte(2000);
ok((await p.locator('.legende').count()) === 1, 'Legende der Bewertungsfarben');
await p.getByRole('button', { name: /^Filter/ }).click();
await warte(400);
await p.locator('.dialog').getByRole('button', { name: 'Hunde' }).click();
await warte(200);
const zeigen = await p.locator('.dialog footer .knopf').last().innerText();
ok(zeigen.includes('4'), `Filter „Hunde“: ${zeigen}`);
await p.locator('.dialog footer .knopf').last().click();
await warte(800);
ok((await p.locator('.plaetze li').count()) === 4 && (await p.locator('.legende .anzahl').innerText()).includes('4 von 14'), 'Liste und Zähler gefiltert');
await foto('2-plaetze');

// --- Ziele ---
await p.goto(BASIS + '#/ziele');
await warte(1500);
await voll();
const gruppen = await p.locator('.seite h4').allInnerTexts();
ok(gruppen.some((g) => g.toLowerCase().includes('schottland')) && gruppen.some((g) => g.toLowerCase().includes('irgendwann')), `Gruppen: ${gruppen.join(' | ')}`);
await p.getByRole('button', { name: 'Ziel merken' }).first().click();
await warte(500);
await p.locator('.dialog input[placeholder="Ort suchen"]').fill('Schloss Neuschwanstein');
await p.waitForSelector('.dialog .vorschlaege button', { timeout: 10000 });
await p.locator('.dialog .vorschlaege button').first().click();
await warte(500);
ok((await p.locator('.dialog input[placeholder="z. B. Deutsches Museum"]').inputValue()).includes('Neuschwanstein'), 'Name kommt aus der Ortssuche');
await p.getByRole('button', { name: 'Merken', exact: true }).click();
await warte(800);
ok((await p.getByText('Neuschwanstein').count()) >= 1, 'Neues Ziel steht auf der Merkliste');
await foto('3-ziele');

// --- Geplante Reise zeigt ihre Ziele ---
await p.goto(BASIS + '#/reise/bsp-sc27');
await warte(1800);
await voll();
ok((await p.locator('.geplant .ziel').count()) === 4, `Schottland: ${await p.locator('.geplant .ziel').count()} geplante Ziele`);
await foto('4-geplant');

// --- Nächte automatisch + Weiterfahren ---
await p.goto(BASIS + '#/');
await warte(800);
await voll();
await p.locator('.neue-reise').click();
await p.locator('input[placeholder^="z. B. Norwegen"]').fill('Jetzt unterwegs');
await p.locator('input[type="date"]').first().fill(format(addDays(new Date(), -3), 'yyyy-MM-dd'));
await p.getByRole('button', { name: 'Anlegen' }).click();
await warte(1000);
// erste Übernachtung vor 3 Tagen, 1 Nacht (man weiß es ja noch nicht)
await voll();
await p.locator('button.knopf.neu').click();
await warte(500);
await p.locator('input[type="date"]').first().fill(format(addDays(new Date(), -3), 'yyyy-MM-dd'));
await p.getByRole('button', { name: 'Hier', exact: true }).click();
await warte(3000);
await p.getByRole('button', { name: 'Eintragen' }).click();
await warte(1200);
// „Hier eintragen“ → Weiterfahren
await p.locator('.griff').click();
await warte(300);
await p.locator('button.hier').click();
await warte(3000);
ok((await p.locator('.weiterfahren').count()) === 1, '„Weiterfahren“ wird angeboten');
await foto('5-weiterfahren-angebot');
await p.locator('.weiterfahren').click();
await warte(1200);
await voll();
const nachtText = await p.locator('.typ-stay .ein-meta').first().innerText();
ok(nachtText.includes('3 Nächte'), `Nächte bis heute gesetzt: „${nachtText.trim()}“`);
ok((await p.locator('.typ-drive .ein-meta', { hasText: 'unterwegs' }).count()) === 1, 'Offene Fahrt „unterwegs …“');
// Ziel erreichen: Übernachtung in Erding → Fahrt endet dort
await p.locator('button.knopf.neu').click();
await warte(500);
await p.locator('input[placeholder="Ort suchen"]').fill('Erding');
await p.waitForSelector('.vorschlaege button', { timeout: 10000 });
await p.locator('.vorschlaege button').first().click();
await warte(600);
ok((await p.locator('.info', { hasText: 'endet hier' }).count()) === 1, 'Hinweis: die laufende Fahrt endet hier');
await p.locator('input[type="date"]').first().fill(heute);
await p.getByRole('button', { name: 'Eintragen' }).click();
await warte(6000);
const fahrt = await p.locator('.typ-drive').first().innerText();
ok(fahrt.includes('Erding') && /km/.test(fahrt), `Fahrt abgeschlossen: „${fahrt.replaceAll('\n', ' | ')}“`);
ok((await p.locator('.typ-drive').count()) === 1, 'Keine doppelte Fahrt angelegt');
await foto('6-angekommen');

// --- Als Ziel merken (Stecknadel) ---
await p.goto(BASIS + '#/ziele');
await warte(1500);
await p.mouse.click(190, 200, { button: 'right' });
await warte(1500);
await p.getByRole('button', { name: 'Als Ziel merken' }).click();
await warte(800);
ok((await p.locator('.dialog', { hasText: 'Ziel merken' }).count()) === 1, 'Stecknadel → „Ziel merken“-Dialog mit Ort');

// „Heute vor einem Jahr“: Uhr auf den 8. Juli 2026 → Norwegen (Juli 2025)
{
	const ctx2 = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'de-DE' });
	const q = await ctx2.newPage();
	await q.clock.setFixedTime(new Date('2026-07-08T10:00:00'));
	await q.goto(BASIS);
	await q.waitForTimeout(2500);
	await q.getByText('Beispielreisen laden').click();
	await q.waitForTimeout(1500);
	const karte = q.locator('a.erinnerung');
	const text = (await karte.count()) ? await karte.first().innerText() : '';
	await q.screenshot({ path: 'tools/bilder/planung-heute-vor.png' });
	ok(/Heute vor 1 Jahr/i.test(text) && text.includes('Norwegen') && text.includes('Preikestolen'), 'Startseite: „Heute vor 1 Jahr“ mit Norwegen (' + text.replace(/\s+/g, ' ') + ')');
	await karte.first().click();
	await q.waitForTimeout(1500);
	ok(q.url().includes('#/reise/bsp-no25') && (await q.locator('.ein.markiert').count()) === 1, 'Tipp darauf öffnet die Reise beim Eintrag des Tages');
	await ctx2.close();
}

await b.close();
console.log(fehler.length ? 'FEHLER:\n' + [...new Set(fehler)].join('\n') : 'Alles in Ordnung');
