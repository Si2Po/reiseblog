// Spielt die App einmal durch und macht Bildschirmfotos (WebKit = Safari-Engine).
// Aufruf: node tools/bilder.mjs [handy|pc]   (Dev-Server muss laufen, Standard :5173)
// DUNKEL=1 für den Dunkelmodus. Bilder landen in tools/bilder/ (nicht im Git).
import { webkit } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASIS = process.env.URL ?? 'http://localhost:5173/';
const dunkel = process.env.DUNKEL === '1';
const geraete = process.argv.slice(2).length ? process.argv.slice(2) : ['handy', 'pc'];
const ziel = 'tools/bilder';
mkdirSync(ziel, { recursive: true });

const browser = await webkit.launch();
const fehler = [];

for (const geraet of geraete) {
	const handy = geraet === 'handy';
	const ctx = await browser.newContext({
		colorScheme: dunkel ? 'dark' : 'light',
		viewport: handy ? { width: 375, height: 812 } : { width: 1440, height: 900 },
		deviceScaleFactor: handy ? 2 : 1,
		geolocation: { latitude: 62.1009, longitude: 7.2061, accuracy: 12 },
		permissions: ['geolocation'],
		locale: 'de-DE'
	});
	const page = await ctx.newPage();
	page.on('pageerror', (e) => fehler.push(`${geraet}: ${e.message}`));
	page.on('console', (m) => m.type() === 'error' && fehler.push(`${geraet}: ${m.text()}`));
	let nr = 0;
	const foto = async (name, warten = 700) => {
		await page.waitForTimeout(warten);
		await page.screenshot({ path: `${ziel}/${geraet}${dunkel ? '-dunkel' : ''}-${String(++nr).padStart(2, '0')}-${name}.png` });
	};
	const voll = async () => {
		if (handy) {
			await page.locator('.griff').click();
			await page.waitForTimeout(250);
			if (!(await page.locator('.inhalt.scrollt').count())) await page.locator('.griff').click();
			await page.waitForTimeout(500);
		}
	};
	const scrollen = (y) => page.locator(handy ? '.inhalt' : '.leiste-inhalt').evaluate((el, y) => (el.scrollTop = y), y);

	await page.goto(BASIS);
	await foto('leer', 3500);

	await page.getByText('Beispielreisen laden').click();
	await foto('reisen', 2500);

	await page.locator('.reise').first().click();
	await foto('reise', 2500);

	await voll();
	await scrollen(560);
	await foto('zeitleiste', 900);

	await page.locator('.typ-stay .ein-knopf').nth(1).click();
	await foto('eintrag-offen', 1500);
	await page.getByRole('button', { name: /^Platz/ }).click();
	await foto('platz', 2000);

	await page.goto(BASIS + '#/plaetze');
	await foto('plaetze', 1500);

	await page.goto(BASIS + '#/suche');
	await page.locator('input[type="search"]').fill('fjord');
	await foto('suche', 1200);

	await page.goto(BASIS + '#/');
	await page.waitForTimeout(1500);
	await page.getByRole('button', { name: 'Kartenoptionen' }).click();
	await page.getByRole('menuitemcheckbox').click();
	await foto('fotokarte', 2000);

	await page.locator('.fpin').first().click();
	await foto('fotokarte-klick', 1500);
	if (await page.locator('.gross').count()) {
		await foto('grossansicht', 500);
		await page.keyboard.press('Escape');
	}

	await page.locator('button.hier').click();
	await foto('hier-eintragen', 3500);
	await page.getByRole('button', { name: 'Übernachtung' }).click();
	await foto('formular-uebernachtung', 1500);
	await page.getByRole('button', { name: 'Abbrechen' }).click();

	await page.goto(BASIS + '#/einstellungen');
	await foto('einstellungen', 1000);

	await page.goto(BASIS + '#/');
	await page.waitForTimeout(800);
	await voll();
	await page.locator('.neue-reise').click();
	await page.locator('input[placeholder^="z. B. Norwegen"]').fill('Testreise Schwarzwald');
	await foto('neue-reise', 600);
	await page.getByRole('button', { name: 'Anlegen' }).click();
	await foto('neue-reise-angelegt', 1500);

	await ctx.close();
}
await browser.close();
console.log(fehler.length ? 'FEHLER:\n' + [...new Set(fehler)].join('\n') : 'keine Fehler');
