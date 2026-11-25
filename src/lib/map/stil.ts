// Kartenstil: OpenFreeMap „Positron“ als ruhige Grundlage, in eigenen Farben neu eingefärbt.
import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

export interface KartenFarben {
	land: string;
	park: string;
	wald: string;
	wasser: string;
	fluss: string;
	eis: string;
	siedlung: string;
	gebaeude: string;
	strasse: string;
	strasseKlein: string;
	strasseRand: string;
	grenze: string;
	text: string;
	textStark: string;
	textHalo: string;
	textWasser: string;
	/** Deckkraft des Natural-Earth-Reliefs bei kleinen Zoomstufen (0 = aus) */
	relief: number;
}

const QUELLE = 'https://tiles.openfreemap.org/styles/positron';
let grundstil: Promise<StyleSpecification> | null = null;

function laden() {
	grundstil ??= fetch(QUELLE).then((r) => r.json());
	return grundstil;
}

/**
 * Selbstheilung, wenn Kacheln nicht laden: Karten-Zwischenspeicher leeren
 * (veraltete Kachel-Übersicht) und den Stil frisch holen.
 */
export async function kartenSpeicherLeeren() {
	grundstil = null;
	if ('caches' in self) await Promise.all(['karte-stil', 'karte'].map((n) => caches.delete(n)));
}

const OHNE = new Set(['highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us', 'airport']);

function farbeFuer(l: LayerSpecification, f: KartenFarben): Record<string, unknown> | null {
	const id = l.id;
	if (l.type === 'background') return { 'background-color': f.land };
	if (id === 'park') return { 'fill-color': f.park };
	if (id === 'water') return { 'fill-color': f.wasser };
	if (id.startsWith('landcover_ice') || id === 'landcover_glacier') return { 'fill-color': f.eis };
	if (id === 'landuse_residential') return { 'fill-color': f.siedlung };
	if (id === 'landcover_wood') return { 'fill-color': f.wald };
	if (id === 'waterway') return { 'line-color': f.fluss };
	if (id === 'building') return { 'fill-color': f.gebaeude, 'fill-outline-color': f.strasseRand };
	if (id.startsWith('road_') || id === 'road_area_pier') return l.type === 'fill' ? { 'fill-color': f.land } : { 'line-color': f.land };
	if (id.includes('dashline')) return { 'line-color': f.land };
	if (id.includes('casing') || id.includes('subtle') || id.startsWith('railway')) return { 'line-color': f.strasseRand };
	if (id.startsWith('aeroway')) return l.type === 'fill' ? { 'fill-color': f.strasseKlein } : { 'line-color': f.strasseKlein };
	if (id === 'highway_minor' || id === 'highway_path') return { 'line-color': f.strasseKlein };
	if (id.includes('inner')) return { 'line-color': f.strasse };
	if (id.startsWith('boundary')) return { 'line-color': f.grenze };
	if (l.type === 'symbol') {
		const wasser = id.startsWith('water');
		const stark = /label_(city|town|country)/.test(id);
		return {
			'text-color': wasser ? f.textWasser : stark ? f.textStark : f.text,
			'text-halo-color': f.textHalo,
			'text-halo-width': 1.4,
			'text-halo-blur': 0.4
		};
	}
	return null;
}

export async function kartenStil(f: KartenFarben): Promise<StyleSpecification> {
	const s: StyleSpecification = structuredClone(await laden());
	const layers: LayerSpecification[] = [];
	for (const l of s.layers) {
		if (OHNE.has(l.id)) continue;
		const paint = farbeFuer(l, f);
		if (paint) (l as { paint?: Record<string, unknown> }).paint = { ...(l as { paint?: object }).paint, ...paint };
		// Länder und Regionen auf Deutsch, Orte in Landessprache (wie auf Ortsschildern)
		if (l.type === 'symbol' && /label_(country|state)|^water_name/.test(l.id) && l.layout) {
			(l.layout as Record<string, unknown>)['text-field'] = ['coalesce', ['get', 'name:de'], ['get', 'name']];
		}
		if (l.type === 'symbol' && /label_(city|town|village|other)/.test(l.id) && l.layout) {
			(l.layout as Record<string, unknown>)['text-field'] = ['coalesce', ['get', 'name:latin'], ['get', 'name']];
			(l.layout as Record<string, unknown>)['icon-image'] = '';
		}
		layers.push(l);
		if (l.type === 'background' && f.relief > 0) {
			layers.push({
				id: 'relief',
				type: 'raster',
				source: 'ne2_shaded',
				maxzoom: 7,
				paint: {
					'raster-opacity': ['interpolate', ['linear'], ['zoom'], 0, f.relief, 6, f.relief * 0.6, 7, 0],
					'raster-saturation': -0.6,
					'raster-contrast': -0.1
				}
			});
		}
	}
	s.layers = layers;
	return s;
}
