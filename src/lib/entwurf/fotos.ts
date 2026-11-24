// Platzhalter-„Fotos“ für die Entwürfe: gezeichnete Landschaften als SVG.
import type { Motiv } from './daten.ts';

const MOTIVE: Record<Motiv, { himmel: [string, string]; sonne: string; berge: string[]; wasser?: string }> = {
	fjord: { himmel: ['#9fc3d6', '#e8eef0'], sonne: '#fff8e6', berge: ['#7d93a0', '#4f6b5c', '#2f4a3c'], wasser: '#3f6f80' },
	kueste: { himmel: ['#8fb8cf', '#f1ece0'], sonne: '#fffbe9', berge: ['#b7c7b0', '#8a9e7c'], wasser: '#4d8a99' },
	alpen: { himmel: ['#a7bdd3', '#f3e7dc'], sonne: '#fff3dc', berge: ['#c9ccd6', '#8d93a3', '#5d6b56', '#3b4a35'] },
	abend: { himmel: ['#f2a65a', '#f9dcc0'], sonne: '#fff1d0', berge: ['#b0706b', '#6f4a55', '#3e2f3d'], wasser: '#7a5560' },
	wald: { himmel: ['#c9d8cc', '#eef0e6'], sonne: '#fbfbef', berge: ['#8fa88c', '#5b7b5a', '#34503a', '#1f3427'] },
	nebel: { himmel: ['#c5ccd0', '#e9ebe9'], sonne: '#ffffff', berge: ['#aab3b5', '#8b9799', '#667477'] }
};

function rnd(seed: number) {
	return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

const cache = new Map<string, string>();

export function fotoUrl(id: string, motiv: Motiv, hoch = false): string {
	const key = id + motiv + hoch;
	const hit = cache.get(key);
	if (hit) return hit;
	const m = MOTIVE[motiv];
	let seed = 0;
	for (const c of id) seed = (seed * 31 + c.charCodeAt(0)) % 2147483647;
	const r = rnd(seed || 7);
	const W = hoch ? 600 : 800;
	const H = hoch ? 800 : 600;
	const schichten = m.berge
		.map((farbe, i) => {
			const basis = H * (0.42 + i * 0.12) + r() * 30;
			const pts: string[] = [`0,${H}`];
			const steps = 7 + Math.floor(r() * 5);
			for (let s = 0; s <= steps; s++) {
				const x = (W / steps) * s;
				const y = basis - (r() * (180 - i * 30)) * (s % 2 ? 1 : 0.4);
				pts.push(`${x.toFixed(0)},${y.toFixed(0)}`);
			}
			pts.push(`${W},${H}`);
			return `<polygon points="${pts.join(' ')}" fill="${farbe}"/>`;
		})
		.join('');
	const wasser = m.wasser
		? `<rect x="0" y="${H * 0.78}" width="${W}" height="${H * 0.22}" fill="${m.wasser}"/><rect x="0" y="${H * 0.8}" width="${W}" height="2" fill="#ffffff" opacity=".25"/>`
		: '';
	const sx = W * (0.2 + r() * 0.6);
	const sy = H * (0.18 + r() * 0.12);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.himmel[0]}"/><stop offset="1" stop-color="${m.himmel[1]}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#h)"/><circle cx="${sx}" cy="${sy}" r="${38 + r() * 20}" fill="${m.sonne}" opacity=".9"/>${schichten}${wasser}</svg>`;
	const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
	cache.set(key, url);
	return url;
}
