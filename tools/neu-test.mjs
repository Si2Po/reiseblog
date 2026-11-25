// Test der Rückmeldungen vom 25.11.: Folgenächte, Notizen, Währung, Reisezeitraum, Ort-Wahl mit Suche,
// langes Drücken, „Fahrt über hier“, Fotos am Eintrag, Links/Merkmale am Platz.
// Aufruf: node tools/neu-test.mjs   (Dev-Server auf :5173)
import { webkit } from 'playwright';

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
const foto = (n) => p.screenshot({ path: `tools/bilder/neu-${n}.png` });
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

// --- 4: Folgenächte + Notiz in späterer Nacht ---
await p.goto(BASIS + '#/reise/bsp-no25');
await warte(1500);
await voll();
ok((await p.locator('.ein.folge').count()) === 8, `Folgenächte in der Zeitleiste: ${await p.locator('.ein.folge').count()} (erwartet 8)`);
const regen = p.locator('.ein.folge', { hasText: 'Kreuzfahrtschiff' });
ok((await regen.count()) === 1 && (await regen.innerText()).includes('Nacht 3 von 4'), 'Notiz „Nacht 3“ steht bei der dritten Nacht');
await regen.scrollIntoViewIfNeeded();
await foto('1-folgenaechte');

// Notiz über „+ Notiz“ an der zweiten Nacht von Geiranger
const nacht2 = p.locator('.ein.folge', { hasText: 'Geiranger Camping' }).filter({ hasText: 'Nacht 2 von 4' });
await nacht2.locator('.ein-knopf').click();
await warte(400);
await p.getByRole('button', { name: 'Notiz', exact: true }).click();
await warte(400);
await p.locator('textarea').fill('Nachbarn bis 1 Uhr laut.');
await foto('1b-notizdialog');
await p.getByRole('button', { name: 'Speichern' }).click();
await warte(800);
ok((await p.locator('.ein.folge', { hasText: 'Nachbarn bis 1 Uhr laut' }).filter({ hasText: 'Nacht 2 von 4' }).count()) === 1, 'Neue Notiz erscheint bei Nacht 2');

// --- 5: Foto direkt am Eintrag ---
const dalsnibba = p.locator('.ein', { hasText: 'Dalsnibba bei Sonnenaufgang' });
await dalsnibba.locator('.ein-knopf').click();
await warte(400);
const bild = await p.evaluate(() => {
	const c = document.createElement('canvas');
	c.width = 900; c.height = 600;
	const g = c.getContext('2d');
	g.fillStyle = '#c96'; g.fillRect(0, 0, 900, 600);
	return c.toDataURL('image/jpeg', 0.9).split(',')[1];
});
const [wahl] = await Promise.all([p.waitForEvent('filechooser'), dalsnibba.getByRole('button', { name: 'Fotos' }).click()]);
await wahl.setFiles({ name: 'heute.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bild, 'base64') });
await warte(2500);
ok((await dalsnibba.locator('.beim-eintrag img').count()) === 1, 'Foto erscheint direkt beim Eintrag (trotz heutigem Aufnahmedatum)');
const hinweis = await p.locator('.hinweis').innerText().catch(() => '');
ok(hinweis.includes('zu „Dalsnibba'), `Rückmeldung nennt den Eintrag: „${hinweis}“`);
await dalsnibba.scrollIntoViewIfNeeded();
await foto('2-foto-am-eintrag');

// --- 2 + 3b: neue Reise, Euro als Standard, Eintrag vor Reisebeginn verlängert die Reise ---
await p.goto(BASIS + '#/');
await warte(800);
await voll();
await p.locator('.neue-reise').click();
await p.locator('input[placeholder^="z. B. Norwegen"]').fill('Bodensee');
await p.locator('input[type="date"]').first().fill('2026-11-24');
await p.getByRole('button', { name: 'Anlegen' }).click();
await warte(1000);
await voll();
await p.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
await warte(500);
ok((await p.locator('select').last().inputValue()) === 'EUR', 'Währung steht auf EUR');
await p.locator('input[type="date"]').first().fill('2026-07-31');
await p.locator('input[placeholder="0 = gratis"]').fill('30');

// --- 3: Ort auf der Karte wählen, mit Suche ---
await p.getByRole('button', { name: 'Auf Karte' }).click();
await warte(700);
const sheetWeg = await p.locator('.sheet').evaluate((el) => el.getBoundingClientRect().top >= innerHeight - 5);
ok(sheetWeg, 'Beim Ort-Wählen ist das Sheet ganz weg');
await p.locator('.wahlsuche input').fill('Deutsches Museum München');
await p.waitForSelector('.wahlsuche .treffer button', { timeout: 10000 });
await p.locator('.wahlsuche .treffer button').first().click();
await warte(2200);
await foto('3-ortwahl-suche');
await p.getByRole('button', { name: 'Übernehmen' }).click();
await warte(2000);
const ortText = await p.locator('.gewaehlt').first().innerText();
ok(/München|Munich/i.test(ortText) && /48,1/.test(ortText), `Gewählter Ort: ${ortText.replaceAll('\n', ' | ')}`);
await p.getByRole('button', { name: 'Eintragen' }).click();
await warte(1200);
const zeit = await p.locator('.zeit').first().innerText();
ok(zeit.includes('31. Juli'), `Reisezeitraum verlängert: „${zeit}“`);
ok((await p.locator('.tagnr').first().innerText()).trim().toLowerCase() === 'tag 1', 'Kein negativer Reisetag');
await foto('4-zeitraum');

// --- 8: kein Privat-Schalter mehr ---
const stayKnopf = p.locator('.typ-stay .ein-knopf').first();
if ((await stayKnopf.getAttribute('aria-expanded')) !== 'true') await stayKnopf.click();
await warte(300);
await p.locator('.typ-stay .aktionen').getByRole('button', { name: 'Bearbeiten' }).click();
await warte(400);
await p.getByRole('button', { name: 'Mehr', exact: true }).click();
await warte(400);
ok((await p.getByText('Privat', { exact: false }).count()) === 0, 'Kein „Privat“-Schalter mehr');
ok((await p.getByText('Ausstattung').count()) > 0 && (await p.getByText('Links zum Wiederfinden').count()) > 0, 'Unter „Mehr“: Merkmale aus dem Katalog und Links');
await foto('5-mehr');
await p.getByRole('button', { name: 'Abbrechen' }).click();
await warte(300);

// --- 7 + 9: Platz mit Link und Merkmal ---
await p.goto(BASIS + '#/platz/bsp-p4');
await warte(1200);
await voll();
await p.getByRole('button', { name: 'Bearbeiten' }).click();
await warte(400);
await p.getByRole('button', { name: 'Am Wasser' }).click();
await p.locator('input[placeholder^="z. B. Park4Night"]').fill('https://park4night.com/de/place/12345');
await p.locator('input[placeholder^="z. B. Park4Night"]').press('Enter');
await p.getByRole('button', { name: 'Speichern' }).click();
await warte(800);
ok((await p.getByRole('link', { name: 'Park4Night' }).count()) === 1, 'Knopf „Park4Night“ auf der Platz-Seite');
ok((await p.locator('.merkmale').innerText()).includes('Am Wasser'), 'Merkmal „Lage: Am Wasser“ wird angezeigt');
ok((await p.getByText('Notizen von unterwegs').count()) === 1, 'Platz zeigt Notizen von unterwegs');
await foto('6-platz');

// --- 6: langes Drücken (hier: Rechtsklick) → Stecknadel → Ausflug ---
await p.goto(BASIS + '#/reise/bsp-no25');
await warte(2000);
await p.mouse.click(190, 200, { button: 'right' });
await warte(1500);
ok((await p.locator('.leiste[aria-label="Ort auf der Karte"]').count()) === 1, 'Stecknadel-Leiste erscheint');
await foto('7-stecknadel');
await p.locator('.leiste').getByRole('button', { name: 'Ausflug' }).click();
await warte(800);
ok((await p.locator('.gewaehlt').count()) === 1, 'Ausflug-Formular mit vorausgefülltem Ort');
await p.getByRole('button', { name: 'Abbrechen' }).click();
await warte(400);

// --- Fahrt über hier ---
const fahrt = p.locator('.typ-drive', { hasText: 'Odda → Geiranger' });
await fahrt.locator('.ein-knopf').click();
await warte(2000);
const vorher = await fahrt.locator('.ein-meta').innerText();
await p.mouse.click(190, 300, { button: 'right' });
await warte(1500);
ok((await p.locator('.ueber-hier').count()) === 1, 'Angebot „Fahrt … über hier führen“');
await foto('8-ueber-hier');
await p.locator('.ueber-hier').click();
await warte(6000);
const nachher = await fahrt.locator('.ein-meta').innerText();
ok(nachher.includes('über') && nachher !== vorher, `Route neu: „${vorher}“ → „${nachher}“`);
await foto('9-route-neu');

// --- Zwischenziel im Formular ---
await fahrt.getByRole('button', { name: 'Bearbeiten' }).click();
await warte(500);
ok((await p.locator('.via').count()) === 1, 'Formular zeigt das Zwischenziel');
await foto('10-via-formular');
await p.getByRole('button', { name: 'Abbrechen' }).click();
await warte(400);

// --- Filter über die Kennzahlen ---
await p.goto(BASIS + '#/reise/bsp-no25');
await warte(1500);
await voll();
await p.locator('.kennzahlen button', { hasText: 'km' }).click();
await warte(400);
const alleFahrt = await p.locator('.zeitleiste .ein').evaluateAll((els) => els.every((e) => e.classList.contains('typ-drive')));
ok(alleFahrt && (await p.locator('.zeitleiste .ein').count()) === 4, `Filter „km“: nur die 4 Fahrten (${await p.locator('.zeitleiste .ein').count()})`);
await p.locator('.kennzahlen button', { hasText: 'Nächte' }).click();
await warte(400);
ok((await p.locator('.zeitleiste .typ-drive').count()) === 0 && (await p.locator('.zeitleiste .folge').count()) === 8, 'Filter „Nächte“: Übernachtungen + Folgenächte');
await foto('11-filter');
await p.locator('.filterzeile').click();
await warte(300);
ok((await p.locator('.zeitleiste .typ-drive').count()) === 4, 'Filter aufgehoben');

// --- Foto löschen (mit Rückgängig) ---
const vorherFotos = await p.locator('.streifen img').count();
await p.locator('.streifen button').first().click();
await warte(600);
await p.getByRole('button', { name: 'Foto löschen' }).click();
await warte(500);
await p.keyboard.press('Escape');
await warte(400);
ok((await p.locator('.streifen img').count()) === vorherFotos - 1, 'Foto gelöscht');
await p.getByRole('button', { name: 'Rückgängig' }).click();
await warte(600);
ok((await p.locator('.streifen img').count()) === vorherFotos, 'Foto wiederhergestellt');

// --- Reihenfolge: Fahrt vor der Übernachtung desselben Tages ---
await p.goto(BASIS + '#/');
await warte(800);
await voll();
await p.locator('.reise', { hasText: 'Bodensee' }).click();
await warte(1000);
await voll();
await p.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
await warte(500);
await p.getByRole('radio', { name: 'Fahrt' }).click();
await p.locator('input[placeholder^="z. B. Über den Pass"]').fill('Anreise');
await p.locator('input[type="date"]').first().fill('2026-07-31');
await p.getByRole('button', { name: 'Eintragen' }).click();
await warte(1200);
const ersteArt = await p.locator('.tag').first().locator('.ein').first().getAttribute('class');
ok(ersteArt.includes('typ-drive'), 'Am selben Tag steht die Fahrt vor der Übernachtung');

await b.close();
console.log(fehler.length ? 'FEHLER:\n' + [...new Set(fehler)].join('\n') : 'Alles in Ordnung');
