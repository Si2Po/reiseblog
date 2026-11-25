/*
  Statistik über alle Reisen: Länder (mit Weltkarte), Nächte, km, Jahre, Rekorde.
  Länder werden aus den Koordinaten bestimmt (Punkt-in-Fläche mit den Natural-Earth-Grenzen in
  static/laender.json) – so zählen auch ältere Einträge ohne Ländercode.
*/
import { asset } from '$app/paths';
import { daten } from '#lib/db/daten.svelte.ts';
import { eintraegeVon, km, naechte, platzBewertung, besuche } from '#lib/auswertung.ts';
import type { Eintrag, Ort } from '#lib/db/typen.ts';

type Ring = [number, number][];
interface Land {
	c: string;
	n: string;
	polys: Ring[][];
	box: [number, number, number, number];
}

let geladen: Promise<{ fc: GeoJSON.FeatureCollection; laender: Land[] }> | null = null;

/** Ländergrenzen einmal laden (ca. 130 KB gezippt, nur für die Statistik) */
export function grenzenLaden() {
	geladen ??= fetch(asset('laender.json'))
		.then((r) => r.json() as Promise<GeoJSON.FeatureCollection>)
		.then((fc) => ({
			fc,
			laender: fc.features.map((f) => {
				const polys = (f.geometry as GeoJSON.MultiPolygon).coordinates as Ring[][];
				const xs = polys.flatMap((p) => p[0].map((q) => q[0]));
				const ys = polys.flatMap((p) => p[0].map((q) => q[1]));
				return { c: f.properties!.c, n: f.properties!.n, polys, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
			})
		}));
	return geladen;
}

function imRing(x: number, y: number, ring: Ring): boolean {
	let drin = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i],
			[xj, yj] = ring[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drin = !drin;
	}
	return drin;
}

/** Ländercode zu einer Koordinate (oder undefined auf dem Meer) */
export function landVon(laender: Land[], o: { lat: number; lng: number }): string | undefined {
	for (const l of laender) {
		const [a, b, c, d] = l.box;
		if (o.lng < a || o.lng > c || o.lat < b || o.lat > d) continue;
		for (const poly of l.polys) if (imRing(o.lng, o.lat, poly[0]) && !poly.slice(1).some((loch) => imRing(o.lng, o.lat, loch))) return l.c;
	}
	return undefined;
}

export interface Statistik {
	reisen: number;
	naechte: number;
	km: number;
	plaetze: number;
	fotos: number;
	laender: { code: string; name: string; naechte: number }[];
	jahre: { jahr: string; naechte: number; km: number; reisen: number }[];
	rekorde: { titel: string; wert: string; link?: string }[];
}

export function berechnen(grenzen: Land[]): Statistik {
	const name = new Map(grenzen.map((l) => [l.c, l.n]));
	const landCache = new Map<string, string | undefined>();
	const land = (o: Ort) => {
		if (o.landCode) return o.landCode;
		const k = `${o.lat.toFixed(3)},${o.lng.toFixed(3)}`;
		if (!landCache.has(k)) landCache.set(k, landVon(grenzen, o));
		return landCache.get(k);
	};

	const nachtProLand = new Map<string, number>();
	const besucht = new Set<string>();
	for (const e of daten.eintraege) {
		const orte = [e.ort, e.von, e.nach, ...(e.via ?? [])].filter(Boolean) as Ort[];
		for (const o of orte) {
			const c = land(o);
			if (c) besucht.add(c);
		}
		if (e.typ === 'stay' && e.ort) {
			const c = land(e.ort);
			if (c) nachtProLand.set(c, (nachtProLand.get(c) ?? 0) + (e.naechte ?? 1));
		}
	}

	const jahre = new Map<string, { naechte: number; km: number; reisen: number }>();
	for (const r of daten.reisen) {
		const j = r.start.slice(0, 4);
		const x = jahre.get(j) ?? { naechte: 0, km: 0, reisen: 0 };
		x.naechte += naechte(r.id);
		x.km += km(r.id);
		x.reisen++;
		jahre.set(j, x);
	}

	// Rekorde
	const rekorde: Statistik['rekorde'] = [];
	const fahrten = daten.eintraege.filter((e) => e.typ === 'drive' && e.km);
	const weiteste = fahrten.sort((a, b) => (b.km ?? 0) - (a.km ?? 0))[0];
	if (weiteste) rekorde.push({ titel: 'Längste Fahrt', wert: `${weiteste.titel} · ${weiteste.km?.toLocaleString('de-DE')} km`, link: `#/reise/${weiteste.reise}` });
	const laengste = [...daten.reisen].sort((a, b) => naechte(b.id) - naechte(a.id))[0];
	if (laengste && naechte(laengste.id)) rekorde.push({ titel: 'Längste Reise', wert: `${laengste.titel} · ${naechte(laengste.id)} Nächte`, link: `#/reise/${laengste.id}` });
	const lieblings = [...daten.plaetze].filter((p) => platzBewertung(p.id)).sort((a, b) => platzBewertung(b.id) - platzBewertung(a.id) || besuche(b.id).length - besuche(a.id).length)[0];
	if (lieblings) rekorde.push({ titel: 'Lieblingsplatz', wert: `${lieblings.name} · ${platzBewertung(lieblings.id).toLocaleString('de-DE', { maximumFractionDigits: 1 })}★`, link: `#/platz/${lieblings.id}` });
	const oft = [...daten.plaetze].sort((a, b) => besuche(b.id).length - besuche(a.id).length)[0];
	if (oft && besuche(oft.id).length > 1) rekorde.push({ titel: 'Am häufigsten besucht', wert: `${oft.name} · ${besuche(oft.id).length}×`, link: `#/platz/${oft.id}` });
	const laengsterAufenthalt = daten.eintraege.filter((e) => e.typ === 'stay').sort((a, b) => (b.naechte ?? 1) - (a.naechte ?? 1))[0] as Eintrag | undefined;
	if (laengsterAufenthalt && (laengsterAufenthalt.naechte ?? 1) > 1)
		rekorde.push({ titel: 'Am längsten an einem Ort', wert: `${laengsterAufenthalt.titel} · ${laengsterAufenthalt.naechte} Nächte`, link: `#/reise/${laengsterAufenthalt.reise}` });

	return {
		reisen: daten.reisen.length,
		naechte: daten.reisen.reduce((s, r) => s + naechte(r.id), 0),
		km: daten.reisen.reduce((s, r) => s + km(r.id), 0),
		plaetze: new Set(daten.eintraege.filter((e) => e.typ === 'stay').map((e) => e.platz ?? e.id)).size,
		fotos: daten.fotos.length,
		laender: [...besucht]
			.map((c) => ({ code: c, name: name.get(c) ?? c, naechte: nachtProLand.get(c) ?? 0 }))
			.sort((a, b) => b.naechte - a.naechte || a.name.localeCompare(b.name)),
		jahre: [...jahre.entries()].map(([jahr, x]) => ({ jahr, ...x })).sort((a, b) => b.jahr.localeCompare(a.jahr)),
		rekorde
	};
}

/** für die Karte: alle Orte (zum Einpassen) */
export const alleOrte = () => daten.reisen.flatMap((r) => eintraegeVon(r.id)).flatMap((e) => [e.ort, e.von, e.nach].filter(Boolean) as Ort[]);
