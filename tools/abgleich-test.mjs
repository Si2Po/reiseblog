// Test des Abgleichs gegen eine nachgebaute Supabase (im Testskript, keine echte Datenbank).
// Voraussetzung: zweiter Dev-Server mit Test-Adresse:
//   VITE_TEST_SUPABASE_URL=https://test.supabase.example npx vite dev --port 5174 --strictPort
// Aufruf: node tools/abgleich-test.mjs
import { webkit } from 'playwright';

const BASIS = 'http://localhost:5174/';
const SB = 'https://test.supabase.example';

// ---------- nachgebaute Supabase ----------
const docs = new Map();
const freigaben = new Map();
let uhr = Date.parse('2026-01-01T00:00:00Z');
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@beispiel.de', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sitzung = () => ({ access_token: 'tok', token_type: 'bearer', expires_in: 360000, expires_at: Math.floor(Date.now() / 1000) + 360000, refresh_token: 'ref', user });

function freigabeLesen(token) {
	const f = freigaben.get(token);
	if (!f || f.widerrufen) return null;
	const u = f.umfang;
	const alle = [...docs.values()].filter((d) => !d.geloescht);
	const reisen = alle.filter((d) => d.art === 'reise' && (u.reisen === 'alle' || u.reisen.includes(d.id)));
	const rids = new Set(reisen.map((d) => d.id));
	const eintraege = alle.filter((d) => d.art === 'eintrag' && rids.has(d.inhalt.reise) && !d.inhalt.privat && (d.inhalt.typ === 'stay' ? u.plaetze : u.unterwegs));
	const pids = new Set(eintraege.map((d) => d.inhalt.platz).filter(Boolean));
	const ohne = (o, felder) => Object.fromEntries(Object.entries(o).filter(([k]) => !felder.includes(k)));
	return {
		name: f.name,
		umfang: u,
		reisen: reisen.map((d) => (u.texte ? d.inhalt : ohne(d.inhalt, ['notiz']))),
		eintraege: eintraege.map((d) => ohne(d.inhalt, [...(u.texte ? [] : ['text']), ...(u.preise ? [] : ['preis', 'waehrung'])])),
		plaetze: alle.filter((d) => d.art === 'platz' && pids.has(d.id)).map((d) => (u.texte ? d.inhalt : ohne(d.inhalt, ['notiz']))),
		fotos: u.fotos ? alle.filter((d) => d.art === 'foto' && rids.has(d.inhalt.reise)).map((d) => d.inhalt) : []
	};
}

async function supabase(route) {
	const req = route.request();
	const url = new URL(req.url());
	const p = url.pathname;
	const m = req.method();
	const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
	const body = () => (req.postData() ? JSON.parse(req.postData()) : null);

	if (p.startsWith('/auth/v1/token') || p.startsWith('/auth/v1/signup')) return json(sitzung());
	if (p === '/auth/v1/user') return json(user);
	if (p === '/auth/v1/logout') return route.fulfill({ status: 204 });
	if (p.startsWith('/storage/v1/object/fotos/')) return json({ Key: p.replace('/storage/v1/object/', '') });
	if (p === '/rest/v1/rpc/aufraeumen') return json(0);
	if (p === '/rest/v1/rpc/ping') return json('wach');
	if (p === '/rest/v1/rpc/freigabe_lesen') return json(freigabeLesen(body().p_token));

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
	if (p === '/rest/v1/freigaben') {
		const einzeln = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
		if (m === 'GET') return json([...freigaben.values()]);
		if (m === 'POST') {
			const f = { token: 'tok' + (freigaben.size + 1) + 'abcdef', widerrufen: false, erstellt_am: new Date().toISOString(), ...body() };
			freigaben.set(f.token, f);
			return json(einzeln ? f : [f], 201);
		}
		if (m === 'PATCH') {
			const t = (url.searchParams.get('token') ?? '').replace('eq.', '');
			Object.assign(freigaben.get(t), body());
			return json(einzeln ? freigaben.get(t) : [freigaben.get(t)]);
		}
		if (m === 'DELETE') return route.fulfill({ status: 204 });
	}
	console.log('  ?? unbekannte Anfrage', m, p);
	return route.fulfill({ status: 404, body: '' });
}

// ---------- Test ----------
const b = await webkit.launch();
const fehler = [];
const ok = (bed, text) => (console.log((bed ? '✓ ' : '✗ ') + text), bed || fehler.push(text));

async function geraet(name) {
	const ctx = await b.newContext({
		viewport: { width: 375, height: 812 },
		geolocation: { latitude: 47.9959, longitude: 7.8522, accuracy: 10 },
		permissions: ['geolocation'],
		locale: 'de-DE'
	});
	await ctx.route(SB + '/**', supabase);
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
	await p.waitForTimeout(3000);
}

// Gerät A: Reise + Übernachtung anlegen, dann anmelden → hochladen
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
await anmelden(a);
const arten = [...docs.values()].map((d) => d.art).sort().join(',');
ok(arten === 'eintrag,platz,reise', `A hat hochgeladen: ${arten}`);
ok((await a.getByText('test@beispiel.de').count()) > 0, 'A ist angemeldet');

// Gerät B: anmelden → bekommt die Reise
const bb = await geraet('B');
await anmelden(bb);
await bb.goto(BASIS + '#/');
await bb.waitForTimeout(1200);
ok((await bb.getByText('Schwarzwald').count()) > 0, 'B sieht die Reise von A');

// B ergänzt einen Ausflug → A holt ihn ab
const reiseId = [...docs.values()].find((d) => d.art === 'reise').id;
await bb.goto(BASIS + '#/reise/' + reiseId);
await bb.waitForTimeout(1000);
await voll(bb);
await bb.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
await bb.waitForTimeout(500);
await bb.getByRole('radio', { name: 'Ausflug' }).click();
await bb.locator('input[placeholder^="z. B. Wanderung"]').fill('Wanderung zum Feldberg');
await bb.getByRole('button', { name: 'Eintragen' }).click();
await bb.waitForTimeout(4500); // Abgleich nach 2,5 s
ok([...docs.values()].some((d) => d.inhalt.titel === 'Wanderung zum Feldberg'), 'B hat den Ausflug hochgeladen');
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
await a.getByRole('button', { name: 'Löschen' }).click();
await a.waitForTimeout(4500);
ok([...docs.values()].some((d) => d.inhalt.titel === 'Wanderung zum Feldberg' && d.geloescht), 'Löschung liegt auf dem Server');
await bb.goto(BASIS + '#/einstellungen');
await voll(bb);
await bb.getByRole('button', { name: 'Abgleichen' }).click();
await bb.waitForTimeout(1500);
await bb.goto(BASIS + '#/reise/' + reiseId);
await bb.waitForTimeout(1000);
ok((await bb.getByText('Wanderung zum Feldberg').count()) === 0, 'B hat die Löschung übernommen');

// Ausflug wieder anlegen (für den Teilen-Test), dann Link „Nur Stellplätze“
await voll(bb);
await bb.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
await bb.waitForTimeout(500);
await bb.getByRole('radio', { name: 'Ausflug' }).click();
await bb.locator('input[placeholder^="z. B. Wanderung"]').fill('Titisee');
await bb.getByRole('button', { name: 'Eintragen' }).click();
await bb.waitForTimeout(4500);

await a.goto(BASIS + '#/einstellungen');
await voll(a);
await a.getByRole('button', { name: 'Neuer Teilen-Link' }).click();
await a.locator('input[placeholder^="z. B. Max"]').fill('Kollegen');
await a.getByRole('button', { name: 'Nur Stellplätze' }).click();
await a.getByRole('button', { name: 'Link erstellen' }).click();
await a.waitForTimeout(800);
const link = await a.locator('.link').innerText().catch(() => '');
ok(/#\/teilen\//.test(link), 'Teilen-Link erstellt: ' + link);
await a.screenshot({ path: 'tools/bilder/abgleich-link.png' });

// Gast öffnet den Link
const gast = await (await b.newContext({ viewport: { width: 375, height: 812 }, locale: 'de-DE' })).newPage();
await gast.context().route(SB + '/**', supabase);
gast.on('pageerror', (e) => fehler.push(`Gast: ${e.message}`));
await gast.goto(link.replace('http://localhost:5174/', BASIS));
await gast.waitForTimeout(2500);
ok((await gast.getByText('Schwarzwald').count()) > 0, 'Gast sieht die geteilte Reise');
await gast.screenshot({ path: 'tools/bilder/abgleich-gast.png' });
await gast.locator('.reise').first().click();
await gast.waitForTimeout(1500);
ok((await gast.locator('.typ-stay').count()) === 1, 'Gast sieht die Übernachtung');
ok((await gast.getByText('Titisee').count()) === 0, 'Gast sieht den Ausflug NICHT (nur Stellplätze)');
ok((await gast.getByText('Ruhiger Platz am Waldrand').count()) === 0, 'Gast sieht den Text NICHT');
ok((await gast.getByText('22').count()) === 0, 'Gast sieht den Preis NICHT');
ok((await gast.getByRole('button', { name: 'Bearbeiten' }).count()) === 0, 'Gast kann nichts bearbeiten');
await gast.screenshot({ path: 'tools/bilder/abgleich-gast-reise.png' });

await b.close();
console.log(fehler.length ? 'FEHLER:\n' + [...new Set(fehler)].join('\n') : 'Alles in Ordnung');
