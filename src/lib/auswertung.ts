// Abgeleitete Werte aus den Daten (reine Funktionen, keine Seiteneffekte).
import type { Eintrag, Foto, LngLat, Platz, Reise } from '#lib/db/typen.ts';
import { daten } from '#lib/db/daten.svelte.ts';
import { abstand } from '#lib/geo.ts';

const TYP_FOLGE = { drive: 0, outing: 1, event: 2, stay: 3 };

export function eintragFolge(a: Eintrag, b: Eintrag): number {
	return a.datum.localeCompare(b.datum) || (a.zeit ?? '').localeCompare(b.zeit ?? '') || TYP_FOLGE[a.typ] - TYP_FOLGE[b.typ];
}

export const reisenSortiert = (): Reise[] => [...daten.reisen].sort((a, b) => b.start.localeCompare(a.start));
export const eintraegeVon = (reise: string): Eintrag[] => daten.eintraege.filter((e) => e.reise === reise).sort(eintragFolge);
export const fotosVon = (reise: string): Foto[] =>
	daten.fotos.filter((f) => f.reise === reise).sort((a, b) => a.aufgenommen.localeCompare(b.aufgenommen));
export const fotosVonEintrag = (eintrag: string): Foto[] => daten.fotos.filter((f) => f.eintrag === eintrag);

export const naechte = (reise: string) => eintraegeVon(reise).reduce((s, e) => s + (e.typ === 'stay' ? (e.naechte ?? 1) : 0), 0);
export const km = (reise: string) => eintraegeVon(reise).reduce((s, e) => s + (e.km ?? 0), 0);
export const plaetzeAnzahl = (reise: string) => new Set(eintraegeVon(reise).filter((e) => e.typ === 'stay').map((e) => e.platz ?? e.id)).size;

/** Ende der Reise: angegeben, sonst letzter Eintrag, sonst Start */
export function reiseEnde(r: Reise): string {
	if (r.ende) return r.ende;
	const e = eintraegeVon(r.id).at(-1);
	return e && e.datum > r.start ? e.datum : r.start;
}

/** Reise, die heute läuft (oder die jüngste, wenn sie erst vor kurzem anfing und kein Ende hat) */
export function laufendeReise(heute = new Date().toISOString().slice(0, 10)): Reise | undefined {
	return reisenSortiert().find((r) => r.start <= heute && (!r.ende || r.ende >= heute));
}

/** Tage einer Reise mit ihren Einträgen und Fotos */
export function tage(reise: string): { datum: string; eintraege: Eintrag[]; fotos: Foto[] }[] {
	const map = new Map<string, { eintraege: Eintrag[]; fotos: Foto[] }>();
	const tag = (d: string) => {
		let t = map.get(d);
		if (!t) map.set(d, (t = { eintraege: [], fotos: [] }));
		return t;
	};
	for (const e of eintraegeVon(reise)) tag(e.datum).eintraege.push(e);
	for (const f of fotosVon(reise)) tag(f.aufgenommen.slice(0, 10)).fotos.push(f);
	return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([datum, t]) => ({ datum, ...t }));
}

export const besuche = (platz: string) => daten.eintraege.filter((e) => e.platz === platz).sort(eintragFolge);
export function platzBewertung(platz: string): number {
	const b = besuche(platz).filter((e) => e.bewertung);
	return b.length ? b.reduce((s, e) => s + e.bewertung!, 0) / b.length : 0;
}

/** Plätze in der Nähe (für „Warst du schon mal hier?“) */
export function plaetzeInDerNaehe(lat: number, lng: number, radius = 300): Platz[] {
	return daten.plaetze
		.map((p) => ({ p, d: abstand(p.ort, { lat, lng }) }))
		.filter((x) => x.d <= radius)
		.sort((a, b) => a.d - b.d)
		.map((x) => x.p);
}

/** Letzte Übernachtung vor einem Datum in einer Reise (Startpunkt für die nächste Fahrt) */
export function letzteUebernachtung(reise: string, vorDatum: string): Eintrag | undefined {
	return eintraegeVon(reise)
		.filter((e) => e.typ === 'stay' && e.ort && e.datum <= vorDatum)
		.at(-1);
}

/** Alle Koordinaten (für „Karte auf Reise einpassen“) */
export function koordinaten(reise?: string): LngLat[] {
	const liste = reise ? eintraegeVon(reise) : daten.eintraege;
	return liste.flatMap((e) => (e.route?.length ? e.route : e.ort ? [[e.ort.lng, e.ort.lat] as LngLat] : []));
}

export const summe = () => ({
	reisen: daten.reisen.length,
	naechte: daten.reisen.reduce((s, r) => s + naechte(r.id), 0),
	km: daten.reisen.reduce((s, r) => s + km(r.id), 0)
});
