// Zusatz-Punkte für die Karte je nach Seite: Plätze (nach Bewertung gefärbt) bzw. Ziele der Merkliste.
import { daten } from '#lib/db/daten.svelte.ts';
import { platzBewertung } from '#lib/auswertung.ts';
import { reiseFarbe } from '#lib/farben.ts';
import type { ZielArt } from '#lib/db/typen.ts';

type FC = GeoJSON.FeatureCollection;
const leer: FC = { type: 'FeatureCollection', features: [] };

/** Farbe nach Bewertung: unbewertet grau, dann rot → gelb → türkis → grün */
export function bewertungsFarbe(w: number, dunkel: boolean): string {
	const hell = ['#9aa39c', '#c2412d', '#c99a1e', '#2a8a8a', '#1d5c3a'];
	const nacht = ['#7a7a74', '#ff7a5c', '#ffd23f', '#5ed0c0', '#9bd36a'];
	const f = dunkel ? nacht : hell;
	if (!w) return f[0];
	if (w < 2.5) return f[1];
	if (w < 3.5) return f[2];
	if (w < 4.5) return f[3];
	return f[4];
}

export const BEWERTUNG_LEGENDE = [
	{ name: '5★', wert: 5 },
	{ name: '4★', wert: 4 },
	{ name: '3★', wert: 3 },
	{ name: '1–2★', wert: 1 },
	{ name: 'ohne', wert: 0 }
];

const ZIEL_FARBE: Record<ZielArt, number> = { stellplatz: 0, stadt: 2, sehenswert: 1, natur: 5, essen: 3, sonstig: 6 };
export const zielFarbe = (art: ZielArt, dunkel: boolean) => reiseFarbe(ZIEL_FARBE[art], dunkel);

function punkt(id: string, name: string, lat: number, lng: number, farbe: string, ring?: string): GeoJSON.Feature {
	return { type: 'Feature', properties: { id, name, farbe, ring }, geometry: { type: 'Point', coordinates: [lng, lat] } };
}

/** Welche Zusatz-Punkte zu welcher Seite gehören */
export function zusatzFuer(route: string | null, param: string | undefined, dunkel: boolean, nurIds?: Set<string>): FC {
	if (route === '/plaetze' || route === '/platz/[id]') {
		return {
			type: 'FeatureCollection',
			features: daten.plaetze
				.filter((p) => !nurIds || nurIds.has(p.id))
				.map((p) => punkt(p.id, p.name, p.ort.lat, p.ort.lng, bewertungsFarbe(platzBewertung(p.id), dunkel), p.id === param ? (dunkel ? '#f5f4ee' : '#111914') : undefined))
		};
	}
	if (route === '/ziele') {
		return {
			type: 'FeatureCollection',
			features: daten.ziele.filter((z) => !z.erledigt).map((z) => punkt(z.id, z.name, z.ort.lat, z.ort.lng, zielFarbe(z.art, dunkel)))
		};
	}
	if (route === '/reise/[id]' && param) {
		// geplante Ziele dieser Reise
		return {
			type: 'FeatureCollection',
			features: daten.ziele
				.filter((z) => z.reise === param && !z.erledigt)
				.map((z) => punkt(z.id, z.name, z.ort.lat, z.ort.lng, zielFarbe(z.art, dunkel), dunkel ? '#ffd23f' : '#f2c230'))
		};
	}
	return leer;
}
