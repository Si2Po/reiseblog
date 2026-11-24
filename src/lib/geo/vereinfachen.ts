// Routenlinie vereinfachen (Douglas-Peucker), damit gespeicherte Routen klein bleiben.
import type { LngLat } from '#lib/db/typen.ts';

function abstandZurStrecke(p: LngLat, a: LngLat, b: LngLat): number {
	// grob in Metern: Längengrad mit cos(Breite) stauchen
	const k = Math.cos((p[1] * Math.PI) / 180);
	const [px, py] = [p[0] * k, p[1]];
	const [ax, ay] = [a[0] * k, a[1]];
	const [bx, by] = [b[0] * k, b[1]];
	const dx = bx - ax,
		dy = by - ay;
	const l = dx * dx + dy * dy;
	let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * 111320;
}

function dp(punkte: LngLat[], toleranz: number): LngLat[] {
	if (punkte.length < 3) return punkte;
	const behalten = new Uint8Array(punkte.length);
	behalten[0] = behalten[punkte.length - 1] = 1;
	const stapel: [number, number][] = [[0, punkte.length - 1]];
	while (stapel.length) {
		const [a, b] = stapel.pop()!;
		let max = 0,
			idx = -1;
		for (let i = a + 1; i < b; i++) {
			const d = abstandZurStrecke(punkte[i], punkte[a], punkte[b]);
			if (d > max) (max = d), (idx = i);
		}
		if (max > toleranz && idx > 0) {
			behalten[idx] = 1;
			stapel.push([a, idx], [idx, b]);
		}
	}
	return punkte.filter((_, i) => behalten[i]);
}

/** Vereinfacht so lange mit wachsender Toleranz, bis höchstens `max` Punkte übrig sind. Koordinaten auf 5 Stellen (~1 m). */
export function vereinfachen(punkte: LngLat[], max = 300): LngLat[] {
	let toleranz = 15;
	let ergebnis = dp(punkte, toleranz);
	while (ergebnis.length > max) {
		toleranz *= 1.6;
		ergebnis = dp(punkte, toleranz);
	}
	return ergebnis.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]);
}
