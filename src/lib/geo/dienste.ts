/*
  Kostenlose Online-Dienste ohne Schlüssel:
  - Photon (komoot): Ortssuche mit Vorschlägen beim Tippen, Ortsname zu Koordinaten
  - OSRM: Straßenroute für Fahrten
  Es werden nur Suchbegriffe bzw. Koordinaten gesendet, keine persönlichen Daten.
*/
import type { LngLat, Ort } from '#lib/db/typen.ts';
import { vereinfachen } from './vereinfachen.ts';

const PHOTON = 'https://photon.komoot.io';
const OSRM = 'https://router.project-osrm.org';

export interface Vorschlag extends Ort {
	/** Zusatzzeile, z. B. „Møre og Romsdal, Norwegen“ */
	zusatz: string;
}

interface PhotonFeature {
	geometry: { coordinates: [number, number] };
	properties: Record<string, string | undefined>;
}

function zuOrt(f: PhotonFeature): Vorschlag {
	const p = f.properties;
	const name = p.name ?? p.city ?? p.town ?? p.village ?? p.street ?? '';
	const ort = p.city ?? p.town ?? p.village ?? p.county;
	const zusatz = [ort !== name ? ort : undefined, p.state, p.country].filter(Boolean).join(', ');
	return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], name, land: p.country, zusatz };
}

/** Ortssuche. Mit `nahe` werden Treffer in der Nähe bevorzugt. */
export async function ortSuchen(text: string, nahe?: { lat: number; lng: number }, signal?: AbortSignal): Promise<Vorschlag[]> {
	const q = new URLSearchParams({ q: text, lang: 'de', limit: '7' });
	if (nahe) q.set('lat', nahe.lat.toFixed(3)), q.set('lon', nahe.lng.toFixed(3));
	const r = await fetch(`${PHOTON}/api/?${q}`, { signal });
	if (!r.ok) throw new Error('Ortssuche gerade nicht erreichbar.');
	const j = (await r.json()) as { features: PhotonFeature[] };
	return j.features.map(zuOrt);
}

/** Ortsname und Land zu Koordinaten (für GPS-Standorte) */
export async function ortsname(lat: number, lng: number): Promise<{ name?: string; land?: string }> {
	try {
		const r = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&lang=de&limit=1`);
		if (!r.ok) return {};
		const j = (await r.json()) as { features: PhotonFeature[] };
		const p = j.features[0]?.properties;
		if (!p) return {};
		return { name: p.city ?? p.town ?? p.village ?? p.name ?? p.county, land: p.country };
	} catch {
		return {};
	}
}

export interface Route {
	route: LngLat[];
	km: number;
	minuten: number;
}

/** Straßenroute über alle Punkte (Start, Zwischenziele, Ziel) */
export async function routeBerechnen(punkte: { lat: number; lng: number }[]): Promise<Route> {
	const wege = punkte.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
	const r = await fetch(`${OSRM}/route/v1/driving/${wege}?overview=full&geometries=geojson`);
	if (!r.ok) throw new Error('Routenplaner gerade nicht erreichbar.');
	const j = await r.json();
	const route = j.routes?.[0];
	if (!route) throw new Error('Keine Straßenroute gefunden.');
	return {
		route: vereinfachen(route.geometry.coordinates as LngLat[]),
		km: Math.round(route.distance / 1000),
		minuten: Math.round(route.duration / 60)
	};
}
