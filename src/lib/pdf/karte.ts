/*
  Kartenbild für das PDF: eine unsichtbare MapLibre-Karte im App-Kartenstil (hell) auf die Reise
  einpassen, warten bis alles geladen ist, als JPEG abgreifen. Die Route zeichnet danach das PDF
  selbst darüber (scharf als Linie) – dafür liefert `xy` die Lage eines Punktes im Bild (0…1).
  Ohne Internet (oder wenn die Kacheln nicht kommen) gibt es kein Bild → das PDF zeigt die Skizze.
*/
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { kartenStil } from '#lib/map/stil.ts';
import { KARTE_HELL } from '#lib/farben.ts';
import type { LngLat } from '#lib/db/typen.ts';

export interface KartenBild {
	bild: string;
	/** Lage eines Punktes im Bild, 0…1 von links bzw. oben */
	xy: (p: LngLat) => [number, number];
	/** Karte wieder abbauen */
	weg: () => void;
}

export const KARTE_QUELLE = '© OpenFreeMap · © OpenMapTiles · © OpenStreetMap-Mitwirkende';

/** breite/hoehe in CSS-Pixeln (gerendert wird 2,5-mal so fein) */
export async function kartenBild(punkte: LngLat[], breite: number, hoehe: number): Promise<KartenBild | null> {
	if (!navigator.onLine || !punkte.length) return null;
	maplibregl.setWorkerUrl(workerUrl);
	const box = document.createElement('div');
	// außerhalb des sichtbaren Bereichs, aber mit echter Größe (sonst zeichnet MapLibre nichts)
	box.style.cssText = `position:fixed;left:${-breite - 200}px;top:0;width:${breite}px;height:${hoehe}px;pointer-events:none`;
	document.body.append(box);
	let map: maplibregl.Map | null = null;
	const weg = () => {
		map?.remove();
		box.remove();
	};
	try {
		const lng = punkte.map((p) => p[0]);
		const lat = punkte.map((p) => p[1]);
		map = new maplibregl.Map({
			container: box,
			style: await kartenStil(KARTE_HELL),
			bounds: [
				[Math.min(...lng), Math.min(...lat)],
				[Math.max(...lng), Math.max(...lat)]
			],
			fitBoundsOptions: { padding: Math.round(Math.min(breite, hoehe) * 0.12), maxZoom: 11 },
			interactive: false,
			attributionControl: false,
			pixelRatio: 2.5,
			fadeDuration: 0,
			canvasContextAttributes: { preserveDrawingBuffer: true }
		});
		const m = map;
		await new Promise<void>((fertig, fehler) => {
			const zeit = setTimeout(() => fehler(new Error('Karte lädt zu lange')), 20000);
			m.once('idle', () => {
				clearTimeout(zeit);
				fertig();
			});
		});
		const bild = m.getCanvas().toDataURL('image/jpeg', 0.85);
		return {
			bild,
			xy: (p) => {
				const q = m.project(p);
				return [q.x / breite, q.y / hoehe];
			},
			weg
		};
	} catch (e) {
		console.warn('Kartenbild für das PDF:', e);
		weg();
		return null;
	}
}
