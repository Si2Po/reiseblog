// Bildschirmfotos der Entwürfe in iPhone-mini-Größe mit WebKit (Safari-Engine).
// Aufruf: node tools/bilder.mjs [stil …]   (Dev-Server muss auf :5173 laufen)
import { webkit } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASIS = process.env.URL ?? 'http://localhost:5173/';
const stile = process.argv.slice(2).length ? process.argv.slice(2) : ['atlas', 'nacht', 'wegweiser'];
const ziel = 'tools/bilder';
mkdirSync(ziel, { recursive: true });

const browser = await webkit.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false });
const fehler = [];

for (const stil of stile) {
	const page = await ctx.newPage();
	page.on('pageerror', (e) => fehler.push(`${stil}: ${e.message}`));
	page.on('console', (m) => m.type() === 'error' && fehler.push(`${stil}: ${m.text()}`));
	const foto = async (name, warten = 600) => {
		await page.waitForTimeout(warten);
		await page.screenshot({ path: `${ziel}/${stil}-${name}.png` });
	};
	await page.goto(`${BASIS}#/entwurf/${stil}`);
	await foto('1-start', 5000);
	await page.locator('.reise').first().click();
	await foto('2-reise', 2600);
	await page.locator('.griff').click();
	await page.waitForTimeout(500);
	await page.locator('.inhalt').evaluate((el) => (el.scrollTop = 520));
	await foto('3-zeitleiste', 900);
	await page.locator('.typ-stay').nth(1).click();
	await foto('4-platz', 2200);
	await page.goto(`${BASIS}#/entwurf/${stil}`);
	await page.reload();
	await page.waitForTimeout(3500);
	await page.locator('.kartenknoepfe button').first().click();
	await foto('5-fotos', 1500);
	await page.locator('.hier').click();
	await foto('6-neu', 700);
	await page.close();
}
await browser.close();
console.log(fehler.length ? 'FEHLER:\n' + [...new Set(fehler)].join('\n') : 'keine Fehler');
