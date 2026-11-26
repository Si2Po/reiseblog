// Test: ruhige Zeitleiste – Tippen klappt nur auf (Foto + „…“), Wischen links (Bearbeiten/Löschen),
// Wischen rechts (Hinzufügen), Aktionen-Menü, „Ausgabe hinzufügen“, Rechtsklick am PC, Sprung aus der Suche, Fotoalbum/Großansicht.
// Echte Touch-Gesten über Chromium (CDP). Aufruf: node tools/zeitleiste-test.mjs   (Dev-Server auf :5173)
import { chromium } from 'playwright';
const BASIS = process.env.URL ?? 'http://localhost:5173/';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'de-DE', hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
const fehler = [];
p.on('pageerror', (e) => fehler.push(e.message));
const ok = (bed, text) => (console.log((bed ? '✓ ' : '✗ ') + text), bed || fehler.push('Prüfung: ' + text));
const warte = (ms) => p.waitForTimeout(ms);
const foto = (n) => p.screenshot({ path: `tools/bilder/zeitleiste-${n}.png` });

/** Wischen mit dem Finger über ein Element (dx in px) */
async function wischen(loc, dx) {
	const box = await loc.boundingBox();
	const x = box.x + box.width / 2,
		y = box.y + Math.min(30, box.height / 2);
	const t = (type, px) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y }] });
	await t('touchStart', x);
	for (let i = 1; i <= 10; i++) {
		await t('touchMove', x + (dx * i) / 10);
		await warte(16);
	}
	await t('touchEnd', x + dx);
	await warte(400);
}

await p.goto(BASIS);
await warte(2500);
await p.getByText('Beispielreisen laden').click();
await warte(1500);
await p.locator('a.reise').nth(1).click(); // Norwegen
await warte(1500);
await p.locator('.griff').click();
await warte(500);

const troll = p.locator('.ein', { hasText: 'Trolltunga' });
await troll.scrollIntoViewIfNeeded();
await troll.locator('.ein-knopf').click();
await warte(400);
await foto('1-offen');
ok((await troll.getByLabel('Fotos hinzufügen').count()) === 1 && (await troll.getByLabel('Mehr').count()) === 1, 'Aufgeklappt: Foto- und „…“-Knopf');
ok((await troll.getByText('Bearbeiten').count()) === 0, 'Keine Knopfreihe mit „Bearbeiten“ mehr');

await troll.getByLabel('Mehr').click();
await warte(400);
await foto('2-menue');
const menue = p.locator('[role=menu]');
ok((await menue.getByText('Ausgabe hinzufügen').count()) === 1 && (await menue.getByText('Löschen').count()) === 1, '„…“ öffnet das Menü mit allen Aktionen');
await p.getByRole('button', { name: 'Abbrechen' }).click();
await warte(400);

// Wischen nach links: Bearbeiten / Löschen
await wischen(troll, -180);
await foto('3-links');
const loeschKnopf = troll.locator('.rechts-seite button', { hasText: 'Löschen' });
ok(await loeschKnopf.isVisible(), 'Nach links wischen zeigt „Löschen“');
await loeschKnopf.click();
await warte(600);
ok((await p.locator('.ein', { hasText: 'Trolltunga' }).count()) === 0, 'Ein Tipp auf „Löschen“ löscht');
await p.getByRole('button', { name: 'Rückgängig' }).click();
await warte(800);
ok((await p.locator('.ein', { hasText: 'Trolltunga' }).count()) === 1, 'Rückgängig holt den Eintrag zurück');

// Wischen nach rechts: Hinzufügen
const cider = p.locator('.ein', { hasText: 'Cider-Probe' });
await cider.scrollIntoViewIfNeeded();
await wischen(cider, 160);
await foto('4-rechts');
ok((await p.locator('[role=menu]').getByText('Fotos hinzufügen').count()) === 1, 'Nach rechts wischen öffnet „Hinzufügen“');
await p.locator('[role=menu]').getByText('Ausgabe hinzufügen').click();
await warte(900);
await foto('5-ausgabe');
ok((await p.locator('.kosten-zeile').count()) === 1, '„Ausgabe hinzufügen“ öffnet den Eintrag mit leerer Ausgabe-Zeile');
await p.getByRole('button', { name: 'Abbrechen' }).click();
await warte(500);

// Senkrecht scrollen darf nicht wischen
const vorher = await p.locator('.ein .vorne[style*=translate]').count();
ok(vorher === 0, 'Keine Zeile bleibt verschoben');

// Aus der Suche direkt zum gefundenen Eintrag (aufgeklappt und sichtbar)
await p.goto(BASIS + '#/suche');
await warte(1000);
await p.locator('input[type=search]').fill('Beine am Ende');
await warte(600);
await p.locator('a', { hasText: 'Trolltunga' }).first().click();
await warte(1500);
await foto('7-suche');
const ziel = p.locator('.ein.markiert', { hasText: 'Trolltunga' });
const box = await ziel.boundingBox();
ok(!!box && box.y > 0 && box.y + 40 < 812, 'Aus der Suche: Eintrag ist markiert und im Blick');

// Fotoalbum: Foto-Ebene nur dort automatisch an, danach wieder wie vorher
await p.goto(BASIS + '#/');
await warte(1200);
const pinsVorher = await p.locator('.fpin').count();
await p.goto(BASIS + '#/fotos');
await warte(1500);
ok((await p.locator('.fpin').count()) > 0, 'Im Fotoalbum stehen die Fotos auf der Karte');
await p.getByRole('link', { name: 'Reisen' }).click();
await warte(1200);
ok((await p.locator('.fpin').count()) === pinsVorher, 'Zurück bei den Reisen gilt wieder die vorige Einstellung');

// Großansicht: seitlich wischen (leicht schräg) blättert, ohne zu schließen
await p.goto(BASIS + '#/fotos');
await warte(1200);
await p.locator('.raster button').first().click();
await warte(600);
const gross = p.locator('.gross');
const box2 = await gross.boundingBox();
const t2 = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
await t2('touchStart', 300, 400);
for (let i = 1; i <= 10; i++) {
	await t2('touchMove', 300 - i * 20, 400 + i * 6);
	await warte(16);
}
await t2('touchEnd', 100, 460);
await warte(500);
ok((await gross.count()) === 1 && (await gross.innerText()).includes('2 von'), 'Schräg seitwärts wischen blättert weiter und schließt nicht');
// nach unten wischen schließt
await t2('touchStart', 200, 300);
for (let i = 1; i <= 10; i++) {
	await t2('touchMove', 200 + i * 2, 300 + i * 20);
	await warte(16);
}
await t2('touchEnd', 220, 500);
await warte(500);
ok((await p.locator('.gross').count()) === 0, 'Nach unten wischen schließt');
// „Auf der Karte“ macht das Blatt klein
await p.locator('.raster button').first().click();
await warte(600);
await p.getByRole('button', { name: 'Auf der Karte' }).click();
await warte(900);
await foto('8-auf-der-karte');
const blatt = await p.locator('.raster').first().boundingBox();
ok(!blatt || blatt.y > 600, '„Auf der Karte“: Blatt ist klein, die Karte hat den Platz');

await b.close();

// PC: Rechtsklick öffnet das Menü an der Maus
const b2 = await chromium.launch();
const q = await (await b2.newContext({ viewport: { width: 1280, height: 800 }, locale: 'de-DE' })).newPage();
await q.goto(BASIS);
await q.waitForTimeout(2500);
await q.getByText('Beispielreisen laden').click();
await q.waitForTimeout(1500);
await q.locator('a.reise').nth(1).click();
await q.waitForTimeout(1500);
await q.locator('.ein', { hasText: 'Trolltunga' }).click({ button: 'right' });
await q.waitForTimeout(300);
await q.screenshot({ path: 'tools/bilder/zeitleiste-6-pc.png' });
ok((await q.locator('.schwebend[role=menu]').count()) === 1, 'PC: Rechtsklick öffnet das Menü an der Maus');
await b2.close();

console.log(fehler.length ? '\nFEHLER:\n' + fehler.join('\n') : '\nAlles gut.');
process.exit(fehler.length ? 1 : 0);
