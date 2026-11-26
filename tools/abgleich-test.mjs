// Test des verschlüsselten Abgleichs gegen eine nachgebaute Supabase (im Testskript, keine echte Datenbank).
// Voraussetzung: zweiter Dev-Server mit Test-Adresse:
//   VITE_TEST_SUPABASE_URL=https://test.supabase.example npx vite dev --port 5174 --strictPort
// Aufruf: node tools/abgleich-test.mjs
import { webkit } from 'playwright';

const BASIS = 'http://localhost:5174/';
const SB = 'https://test.supabase.example';

// ---------- nachgebaute Supabase ----------
const docs = new Map();
const dateien = new Map();
let tresor = null;
let uhr = Date.parse('2026-01-01T00:00:00Z');
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@beispiel.de', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sitzung = () => ({ access_token: 'tok', token_type: 'bearer', expires_in: 360000, expires_at: Math.floor(Date.now() / 1000) + 360000, refresh_token: 'ref', user });

async function supabase(route) {
	const req = route.request();
	const url = new URL(req.url());
	const p = url.pathname;
	const m = req.method();
	if (process.env.DBG && p.includes('storage')) console.log('  [speicher]', m, p);
	const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
	const body = () => (req.postData() ? JSON.parse(req.postData()) : null);

	if (p.startsWith('/auth/v1/token') || p.startsWith('/auth/v1/signup')) return json(sitzung());
	if (p === '/auth/v1/user') return json(user);
	if (p === '/auth/v1/logout') return route.fulfill({ status: 204 });
	// Fotospeicher (privat): hochladen und authentifiziert herunterladen
	if (p.startsWith('/storage/v1/object/fotos/') && m === 'POST') {
		dateien.set(p.replace('/storage/v1/object/fotos/', ''), req.postDataBuffer());
		return json({ Key: p.replace('/storage/v1/object/', '') });
	}
	if (p.startsWith('/storage/v1/object/authenticated/fotos/') || (p.startsWith('/storage/v1/object/fotos/') && m === 'GET')) {
		const k = p.replace(/^\/storage\/v1\/object\/(authenticated\/)?fotos\//, '');
		const d = dateien.get(k);
		return d ? route.fulfill({ status: 200, contentType: 'application/octet-stream', body: d }) : json({ error: 'not found' }, 404);
	}
	if (p === '/storage/v1/object/fotos' && m === 'DELETE') {
		const weg = body()?.prefixes ?? [];
		for (const k of weg) dateien.delete(k);
		return json(weg.map((name) => ({ name })));
	}
	if (p === '/rest/v1/rpc/aufraeumen') return json(0);
	if (p === '/rest/v1/rpc/ping') return json('wach');

	if (p === '/rest/v1/tresor') {
		const einzeln = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
		if (m === 'GET') return einzeln ? (tresor ? json(tresor) : json(null, 406)) : json(tresor ? [tresor] : []);
		if (m === 'POST') {
			if (tresor) return json({ code: '23505', message: 'duplicate key' }, 409);
			tresor = body();
			return route.fulfill({ status: 201, body: '' });
		}
		if (m === 'PATCH') {
			Object.assign(tresor, body());
			return route.fulfill({ status: 204, body: '' });
		}
	}
	if (p === '/rest/v1/dokumente' && m === 'POST') {
		for (const z of [].concat(body())) docs.set(z.id, { ...z, geaendert_am: new Date((uhr += 1000)).toISOString() });
		return route.fulfill({ status: 201, body: '' });
	}
	if (p === '/rest/v1/dokumente' && m === 'GET') {
		const gt = (url.searchParams.get('geaendert_am') ?? 'gt.1970').slice(3);
		const lim = +(url.searchParams.get('limit') ?? 1000);
		const liste = [...docs.values()].filter((d) => d.geaendert_am > gt).sort((a, b) => a.geaendert_am.localeCompare(b.geaendert_am)).slice(0, lim);
		return json(liste);
	}
	console.log('  ?? unbekannte Anfrage', m, p);
	return route.fulfill({ status: 404, body: '' });
}

// ---------- Test ----------
const b = await webkit.launch();
const fehler = [];
const ok = (bed, text) => (console.log((bed ? '✓ ' : '✗ ') + text), bed || fehler.push(text));

/** versatz: Uhr des Geräts in ms vorstellen (z. B. „zwei Tage später“) */
async function geraet(name, versatz = 0) {
	const ctx = await b.newContext({
		viewport: { width: 375, height: 812 },
		geolocation: { latitude: 47.9959, longitude: 7.8522, accuracy: 10 },
		permissions: ['geolocation'],
		locale: 'de-DE'
	});
	await ctx.route(SB + '/**', supabase);
	if (versatz)
		await ctx.addInitScript((v) => {
			const echt = Date.now;
			Date.now = () => echt() + v;
		}, versatz);
	const p = await ctx.newPage();
	p.on('pageerror', (e) => fehler.push(`${name}: ${e.message}`));
	p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && fehler.push(`${name}: ${m.text()}`));
	await p.goto(BASIS);
	await p.waitForTimeout(2000);
	return p;
}
async function voll(p) {
	await p.locator('.griff').click();
	await p.waitForTimeout(250);
	if (!(await p.locator('.inhalt.scrollt').count())) await p.locator('.griff').click();
	await p.waitForTimeout(400);
}
async function anmelden(p) {
	await p.goto(BASIS + '#/einstellungen');
	await voll(p);
	await p.locator('input[type="email"]').fill('test@beispiel.de');
	await p.locator('input[type="password"]').fill('geheim123');
	await p.getByRole('button', { name: 'Anmelden' }).click();
	await p.waitForTimeout(2000);
}
const klartext = () => JSON.stringify([...docs.values()]);

// Gerät A: Reise + Übernachtung + Foto anlegen, dann anmelden → Verschlüsselung einrichten → hochladen
const a = await geraet('A');
await a.getByRole('button', { name: 'Neue Reise' }).first().click();
await a.locator('input[placeholder^="z. B. Norwegen"]').fill('Schwarzwald');
await a.getByRole('button', { name: 'Anlegen' }).click();
await a.waitForTimeout(800);
await a.locator('button.hier').click();
await a.waitForTimeout(2500);
await a.getByRole('button', { name: 'Übernachtung' }).click();
await a.waitForTimeout(500);
await a.locator('input[placeholder="0 = gratis"]').fill('22');
await a.locator('textarea').fill('Ruhiger Platz am Waldrand.');
await a.getByRole('button', { name: 'Eintragen' }).click();
await a.waitForTimeout(800);
const bild = await a.evaluate(() => {
	const c = document.createElement('canvas');
	c.width = 800;
	c.height = 600;
	const g = c.getContext('2d');
	g.fillStyle = '#c0392b';
	g.fillRect(0, 0, 800, 600);
	return c.toDataURL('image/jpeg', 0.9).split(',')[1];
});
await voll(a);
const [wahl] = await Promise.all([a.waitForEvent('filechooser'), a.locator('.fotos-leer, .streifen .mehr').first().click()]);
await wahl.setFiles({ name: 'rot.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bild, 'base64') });
await a.waitForTimeout(3000);

await anmelden(a);
ok((await a.getByText('Verschlüsselung einrichten').count()) > 0, 'A: Verschlüsselung wird angeboten');
ok(docs.size === 0, 'Vor dem Einrichten wird nichts hochgeladen');
await a.locator('input[autocomplete="new-password"]').nth(0).fill('Unser Reisetagebuch 2026');
await a.locator('input[autocomplete="new-password"]').nth(1).fill('Unser Reisetagebuch 2026');
await a.getByRole('button', { name: 'Verschlüsselung einrichten' }).click();
await a.waitForTimeout(4000);
const code = (await a.locator('.code-box code').innerText()).trim();
ok(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){4}$/.test(code), `Notfall-Code angezeigt: ${code}`);
await a.screenshot({ path: 'tools/bilder/abgleich-code.png' });
await a.locator('.code-box input[type="checkbox"]').check();
await a.getByRole('button', { name: 'Fertig' }).click();
await a.waitForTimeout(3500);
const arten = [...docs.values()].map((d) => d.art).sort().join(',');
ok(arten === 'eintrag,foto,platz,reise', `A hat hochgeladen: ${arten}`);
ok(!/Schwarzwald|Waldrand|"preis"|titel|vorschau/.test(klartext()), 'Auf dem Server steht nichts Lesbares');
ok(!!tresor && !JSON.stringify(tresor).includes('Reisetagebuch'), 'Tresor liegt auf dem Server, ohne Passwort');
const datei = [...dateien.values()][0];
ok(dateien.size === 1 && !(datei[0] === 0xff && datei[1] === 0xd8), 'Foto liegt verschlüsselt im Speicher (kein JPEG)');
await a.screenshot({ path: 'tools/bilder/abgleich-a.png' });

// Gerät B: anmelden → entsperren → bekommt Reise und Foto
const bb = await geraet('B');
await anmelden(bb);
ok((await bb.getByText('Tagebuch entsperren').count()) > 0, 'B: muss entsperren');
await bb.locator('input[autocomplete="current-password"]').last().fill('falsch falsch');
await bb.getByRole('button', { name: 'Entsperren' }).click();
await bb.waitForTimeout(4000);
ok((await bb.getByText('Das passt nicht').count()) > 0, 'Falsches Passwort wird abgelehnt');
await bb.locator('input[autocomplete="current-password"]').last().fill('Unser Reisetagebuch 2026');
await bb.getByRole('button', { name: 'Entsperren' }).click();
await bb.waitForTimeout(5000);
ok((await bb.getByText('Ende-zu-Ende verschlüsselt').count()) > 0, 'B ist entsperrt');
await bb.goto(BASIS + '#/');
await bb.waitForTimeout(1200);
ok((await bb.getByText('Schwarzwald').count()) > 0, 'B sieht die Reise von A');
const reiseId = [...docs.values()].find((d) => d.art === 'reise').id;
await bb.goto(BASIS + '#/reise/' + reiseId);
await bb.waitForTimeout(1200);
await voll(bb);
ok((await bb.getByText('Ruhiger Platz am Waldrand').count()) > 0, 'B sieht die Notiz (entschlüsselt)');
await bb.locator('.streifen button').first().click();
await bb.waitForTimeout(2500);
const farbe = await bb.evaluate(async () => {
	const img = [...document.querySelectorAll('img')].find((i) => i.src.startsWith('blob:'));
	if (!img) return null;
	await img.decode();
	const c = document.createElement('canvas');
	c.width = c.height = 4;
	const g = c.getContext('2d');
	g.drawImage(img, 0, 0, 4, 4);
	return [...g.getImageData(1, 1, 1, 1).data.slice(0, 3)];
});
ok(!!farbe && farbe[0] > 150 && farbe[1] < 100, `B sieht das Foto in voller Größe (entschlüsselt, Farbe ${farbe})`);
await bb.keyboard.press('Escape');

// B ergänzt einen Ausflug → A holt ihn ab
await bb.goto(BASIS + '#/reise/' + reiseId);
await bb.waitForTimeout(800);
await voll(bb);
await bb.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
await bb.waitForTimeout(500);
await bb.getByRole('radio', { name: 'Ausflug' }).click();
await bb.locator('input[placeholder^="z. B. Wanderung"]').fill('Wanderung zum Feldberg');
await bb.getByRole('button', { name: 'Eintragen' }).click();
await bb.waitForTimeout(4500);
ok([...docs.values()].filter((d) => d.art === 'eintrag').length === 2 && !klartext().includes('Feldberg'), 'B hat den Ausflug verschlüsselt hochgeladen');
await a.goto(BASIS + '#/einstellungen');
await a.waitForTimeout(500);
await voll(a);
await a.getByRole('button', { name: 'Abgleichen' }).click();
await a.waitForTimeout(1500);
await a.goto(BASIS + '#/reise/' + reiseId);
await a.waitForTimeout(1000);
ok((await a.getByText('Wanderung zum Feldberg').count()) > 0, 'A sieht den Ausflug von B');

// A löscht den Ausflug → B bekommt die Löschung
await voll(a);
await a.getByText('Wanderung zum Feldberg').click();
await a.locator('.aktionen').getByLabel('Mehr').click();
await a.waitForTimeout(300);
await a.getByRole('menuitem', { name: 'Löschen', exact: true }).click();
await a.waitForTimeout(4500);
ok([...docs.values()].some((d) => d.art === 'eintrag' && d.geloescht), 'Löschung liegt auf dem Server');
await bb.goto(BASIS + '#/einstellungen');
await voll(bb);
await bb.getByRole('button', { name: 'Abgleichen' }).click();
await bb.waitForTimeout(1500);
await bb.goto(BASIS + '#/reise/' + reiseId);
await bb.waitForTimeout(1000);
ok((await bb.getByText('Wanderung zum Feldberg').count()) === 0, 'B hat die Löschung übernommen');

// Gerät C: mit Notfall-Code entsperren → neues Passwort festlegen
const cc = await geraet('C');
await anmelden(cc);
await cc.locator('input[autocomplete="current-password"]').last().fill(code.toLowerCase().replaceAll('-', ' '));
await cc.getByRole('button', { name: 'Entsperren' }).click();
await cc.waitForTimeout(5000);
ok((await cc.getByText('Neues Tagebuch-Passwort').count()) > 0, 'C: mit Notfall-Code entsperrt, neues Passwort wird verlangt');
await cc.locator('input[autocomplete="new-password"]').nth(0).fill('Neues Passwort 2027');
await cc.locator('input[autocomplete="new-password"]').nth(1).fill('Neues Passwort 2027');
await cc.getByRole('button', { name: 'Passwort speichern' }).click();
await cc.waitForTimeout(4000);
ok((await cc.getByText('Ende-zu-Ende verschlüsselt').count()) > 0, 'C: neues Passwort gesetzt');
await cc.goto(BASIS + '#/');
await cc.waitForTimeout(1500);
ok((await cc.getByText('Schwarzwald').count()) > 0, 'C sieht die Reise');

// Abmelden entfernt den Schlüssel vom Gerät
await bb.goto(BASIS + '#/einstellungen');
await voll(bb);
await bb.getByRole('button', { name: 'Abmelden' }).click();
await bb.waitForTimeout(800);
const schluesselWeg = await bb.evaluate(
	() =>
		new Promise((fertig) => {
			const r = indexedDB.open('reiseblog');
			r.onsuccess = () => {
				const g = r.result.transaction('meta').objectStore('meta').get('tresor');
				g.onsuccess = () => fertig(!g.result);
			};
		})
);
ok(schluesselWeg, 'Nach dem Abmelden ist der Schlüssel vom Gerät entfernt');

// Foto gelöscht → ein Gerät, das zwei Tage später abgleicht, entfernt die Datei auch aus dem Speicher
const fotoDoc = [...docs.values()].find((d) => d.art === 'foto');
docs.set(fotoDoc.id, { ...fotoDoc, geloescht: true, geaendert_am: new Date((uhr += 1000)).toISOString() });
ok(dateien.size === 1, 'Fotodatei liegt noch im Speicher');
const dd = await geraet('D', 2 * 86400_000);
await anmelden(dd);
await dd.locator('input[autocomplete="current-password"]').last().fill('Neues Passwort 2027');
await dd.getByRole('button', { name: 'Entsperren' }).click();
await dd.waitForTimeout(6000);
ok(dateien.size === 0, 'Nach einem Tag ist die Datei des gelöschten Fotos auch aus dem Speicher entfernt');

await b.close();
console.log(fehler.length ? 'FEHLER:\n' + [...new Set(fehler)].join('\n') : 'Alles in Ordnung');
