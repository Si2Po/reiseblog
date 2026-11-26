// Abgeleitete Werte aus den Daten (reine Funktionen, keine Seiteneffekte).
import type { Eintrag, Foto, LngLat, Notiz, Platz, Reise } from '#lib/db/typen.ts';
import { format, parseISO, addDays, setYear } from 'date-fns';
import { plusTage } from '#lib/datum.ts';
import { daten } from '#lib/db/daten.svelte.ts';
import { abstand } from '#lib/geo.ts';

const TYP_FOLGE = { drive: 0, outing: 1, stay: 2 };

/**
 * Reihenfolge am Tag: Die Übernachtung schließt den Tag ab (steht immer nach Fahrt und Ausflug).
 * Die Uhrzeit ordnet nur innerhalb gleicher Gruppe.
 */
export function eintragFolge(a: Eintrag, b: Eintrag): number {
	const nacht = (e: Eintrag) => (e.typ === 'stay' ? 1 : 0);
	return (
		a.datum.localeCompare(b.datum) ||
		nacht(a) - nacht(b) ||
		(a.zeit ?? '').localeCompare(b.zeit ?? '') ||
		TYP_FOLGE[a.typ] - TYP_FOLGE[b.typ]
	);
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

/** Reise, die heute läuft (Enddatum offen und zuletzt aktiv, oder heute im Zeitraum) */
export function laufendeReise(heute = format(new Date(), 'yyyy-MM-dd')): Reise | undefined {
	return reisenSortiert().find((r) => r.start <= heute && reiseBis(r) >= heute);
}

/** Vorgeschlagene Reise für einen neuen Eintrag: die laufende, sonst die letzte schon begonnene (geplante nur, wenn es nichts anderes gibt). */
export function vorschlagReise(heute = format(new Date(), 'yyyy-MM-dd')): Reise | undefined {
	const alle = reisenSortiert();
	return laufendeReise(heute) ?? alle.find((r) => r.start <= heute) ?? alle[0];
}

/**
 * Letzter Tag, der noch zur Reise zählt.
 * Ohne Enddatum: bis heute, solange die Reise frisch ist (letzter Eintrag höchstens 30 Tage her) –
 * sonst bis zum letzten Eintrag. So landen heutige Fotos nicht in einer alten Reise.
 */
export function reiseBis(r: Reise): string {
	if (r.ende) return r.ende;
	const heute = format(new Date(), 'yyyy-MM-dd');
	const letzter = eintraegeVon(r.id).reduce((m, e) => {
		const bis = e.typ === 'stay' ? plusTage(e.datum, e.naechte ?? 1) : e.datum;
		return bis > m ? bis : m;
	}, r.start);
	if (letzter >= heute) return letzter;
	return plusTage(letzter, 30) >= heute ? heute : letzter;
}

/** Folgenacht einer mehrtägigen Übernachtung (Nacht 2, 3 …) */
export interface Nacht {
	eintrag: Eintrag;
	nr: number;
	von: number;
}
export interface Tag {
	datum: string;
	eintraege: Eintrag[];
	naechte: Nacht[];
	/** Fotos dieses Tages, die keinem Eintrag zugeordnet sind */
	fotos: Foto[];
}

/** Tage einer Reise: Einträge, Folgenächte, lose Fotos */
export function tage(reise: string): Tag[] {
	const r = daten.reise(reise);
	const map = new Map<string, Tag>();
	const tag = (d: string) => {
		let t = map.get(d);
		if (!t) map.set(d, (t = { datum: d, eintraege: [], naechte: [], fotos: [] }));
		return t;
	};
	for (const e of eintraegeVon(reise)) {
		tag(e.datum).eintraege.push(e);
		const n = e.typ === 'stay' ? (e.naechte ?? 1) : 1;
		for (let i = 2; i <= n; i++) tag(plusTage(e.datum, i - 1)).naechte.push({ eintrag: e, nr: i, von: n });
	}
	const bis = r ? reiseBis(r) : '9999';
	for (const f of fotosVon(reise)) {
		const d = f.aufgenommen.slice(0, 10);
		if (f.eintrag && daten.eintrag(f.eintrag)) continue; // erscheint direkt beim Eintrag
		if (r && (d < r.start || d > bis)) continue; // erscheint unter „Weitere Fotos“
		tag(d).fotos.push(f);
	}
	return [...map.values()].sort((a, b) => a.datum.localeCompare(b.datum));
}

/** Fotos einer Reise, deren Datum außerhalb der Reise liegt und die keinem Eintrag gehören */
export function weitereFotos(reise: string): Foto[] {
	const r = daten.reise(reise);
	if (!r) return [];
	const bis = reiseBis(r);
	return fotosVon(reise).filter((f) => {
		const d = f.aufgenommen.slice(0, 10);
		return !(f.eintrag && daten.eintrag(f.eintrag)) && (d < r.start || d > bis);
	});
}

/**
 * Notizen einer Übernachtung, die zu einer bestimmten Nacht gehören.
 * Notizen vor 12 Uhr zählen zur Nacht davor („Nacht 2: morgens Nachbarn laut“).
 * Notizen außerhalb des Zeitraums landen bei der ersten bzw. letzten Nacht.
 */
export function nachtNotizen(e: Eintrag, nachtDatum: string): Notiz[] {
	const n = e.naechte ?? 1;
	const letzte = plusTage(e.datum, n - 1);
	return (e.notizen ?? [])
		.filter((x) => {
			let d = x.zeit.slice(0, 10);
			if (x.zeit.slice(11, 13) < '12') d = plusTage(d, -1);
			if (d < e.datum) d = e.datum;
			if (d > letzte) d = letzte;
			return d === nachtDatum;
		})
		.sort((a, b) => a.zeit.localeCompare(b.zeit));
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
	const k = liste.flatMap((e) => (e.route?.length ? e.route : e.ort ? [[e.ort.lng, e.ort.lat] as LngLat] : e.von ? [[e.von.lng, e.von.lat] as LngLat] : []));
	// geplante Ziele einer Reise gehören mit ins Bild
	if (reise) for (const z of daten.ziele) if (z.reise === reise && !z.erledigt) k.push([z.ort.lng, z.ort.lat]);
	return k;
}

export const summe = () => ({
	reisen: daten.reisen.length,
	naechte: daten.reisen.reduce((s, r) => s + naechte(r.id), 0),
	km: daten.reisen.reduce((s, r) => s + km(r.id), 0)
});

/** „Heute vor einem Jahr“: ein Reisetag aus einem früheren Jahr zum heutigen Datum (oder bis 3 Tage daneben) */
export interface Erinnerung {
	reise: Reise;
	datum: string;
	/** wie viele Jahre her */
	jahre: number;
	/** genau heute (sonst „diese Woche“) */
	genau: boolean;
	/** wichtigster Eintrag des Tages (Übernachtung der Nacht, sonst der letzte des Tages) */
	eintrag?: Eintrag;
	fotos: Foto[];
}

export function erinnerungen(heuteS = format(new Date(), 'yyyy-MM-dd')): Erinnerung[] {
	const jetzt = parseISO(heuteS);
	const liste: Erinnerung[] = [];
	for (const r of daten.reisen) {
		if (r.start >= heuteS) continue;
		const bis = reiseBis(r);
		const vonJahr = Number(r.start.slice(0, 4));
		const bisJahr = Math.min(Number(bis.slice(0, 4)), jetzt.getFullYear() - 1);
		let treffer: Erinnerung | undefined;
		// erst genau heute, dann bis 3 Tage daneben
		for (const versatz of [0, -1, 1, -2, 2, -3, 3]) {
			for (let jahr = bisJahr; jahr >= vonJahr && !treffer; jahr--) {
				const tag = format(addDays(setYear(jetzt, jahr), versatz), 'yyyy-MM-dd');
				if (tag < r.start || tag > bis) continue;
				const t = tage(r.id).find((x) => x.datum === tag);
				const nacht = t?.eintraege.find((e) => e.typ === 'stay') ?? t?.naechte[0]?.eintrag;
				const fotos = fotosVon(r.id).filter((f) => f.aufgenommen.startsWith(tag));
				if (!t && !fotos.length) continue;
				treffer = { reise: r, datum: tag, jahre: jetzt.getFullYear() - jahr, genau: versatz === 0, eintrag: nacht ?? t?.eintraege.at(-1), fotos };
			}
			if (treffer) break;
		}
		if (treffer) liste.push(treffer);
	}
	return liste.sort((a, b) => Number(b.genau) - Number(a.genau) || a.jahre - b.jahre).slice(0, 2);
}
