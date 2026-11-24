<!--
  Karte mit MapLibre: Routen und Punkte als GeoJSON-Ebenen,
  Fotos als runde Vorschaubilder (nahe beieinander → Stapel mit Anzahl),
  eigener Standort als Punkt. Wird über die exportierten Funktionen gesteuert.
-->
<script lang="ts" module>
	export interface KartenFoto {
		id: string;
		lat: number;
		lng: number;
		url: string;
	}
	export interface Rand {
		top: number;
		bottom: number;
		left: number;
		right: number;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import type { GeoJSONSource, LngLatBoundsLike } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	// Worker von Vite bündeln lassen; MapLibres eigene Pfadsuche klappt nach dem Bündeln nicht.
	import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import Supercluster from 'supercluster';
	import { kartenStil, type KartenFarben } from './stil.ts';

	type FC = GeoJSON.FeatureCollection;

	let {
		farben,
		halo,
		linien,
		punkte,
		fotos = [],
		fotosAn = false,
		auswahl = null,
		ich = null,
		onpunkt,
		onreise,
		onfoto,
		onbereit
	}: {
		farben: KartenFarben;
		halo: string;
		linien: FC;
		punkte: FC;
		fotos?: KartenFoto[];
		fotosAn?: boolean;
		auswahl?: string | null;
		/** eigener Standort */
		ich?: { lat: number; lng: number; genau: number } | null;
		onpunkt?: (id: string) => void;
		onreise?: (id: string) => void;
		onfoto?: (id: string) => void;
		onbereit?: () => void;
	} = $props();

	let box: HTMLDivElement;
	let map: maplibregl.Map | undefined = $state();
	let bereit = $state(false);
	let fotoMarker: maplibregl.Marker[] = [];
	let ichMarker: maplibregl.Marker | null = null;

	// --- von außen aufrufbar ---
	export function zeigeBereich(coords: [number, number][], rand: Rand, maxZoom = 11) {
		if (!map || !coords.length) return;
		const b = new maplibregl.LngLatBounds(coords[0], coords[0]);
		for (const c of coords) b.extend(c);
		map.fitBounds(b as LngLatBoundsLike, { padding: rand, duration: 1300, maxZoom, essential: true });
	}
	export function zeigePunkt(lng: number, lat: number, rand: Rand, zoom = 12) {
		// nie herauszoomen, wenn man schon näher dran ist
		map?.flyTo({ center: [lng, lat], zoom: Math.max(zoom, map.getZoom()), padding: rand, duration: 1300, essential: true });
	}
	/** Mitte des sichtbaren Bereichs (berücksichtigt den Rand) */
	export function mitte(): { lat: number; lng: number } | null {
		if (!map) return null;
		const c = map.getCenter();
		return { lat: c.lat, lng: c.lng };
	}
	/** Koordinate unter einem Bildschirmpunkt (für das Fadenkreuz bei „Ort wählen“) */
	export function ortBei(x: number, y: number): { lat: number; lng: number } | null {
		if (!map) return null;
		const r = box.getBoundingClientRect();
		const p = map.unproject([x - r.left, y - r.top]);
		return { lat: p.lat, lng: p.lng };
	}

	function ebenenAnlegen() {
		if (!map) return;
		map.setProjection({ type: 'globe' });
		map.addSource('linien', { type: 'geojson', data: linien });
		map.addSource('punkte', { type: 'geojson', data: punkte });
		map.addLayer({
			id: 'linien-halo',
			type: 'line',
			source: 'linien',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': halo, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 5, 10, 9] }
		});
		map.addLayer({
			id: 'linien',
			type: 'line',
			source: 'linien',
			filter: ['!', ['to-boolean', ['get', 'gerade']]],
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': ['get', 'farbe'], 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.4, 10, 4.5] }
		});
		// Fahrten ohne berechnete Straßenroute: gestrichelte gerade Linie
		map.addLayer({
			id: 'linien-gerade',
			type: 'line',
			source: 'linien',
			filter: ['to-boolean', ['get', 'gerade']],
			paint: {
				'line-color': ['get', 'farbe'],
				'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2, 10, 3.5],
				'line-dasharray': [1.5, 1.5]
			}
		});
		map.addLayer({
			id: 'punkte',
			type: 'circle',
			source: 'punkte',
			paint: {
				'circle-radius': [
					'interpolate', ['linear'], ['zoom'],
					3, ['case', ['==', ['get', 'typ'], 'stay'], 4, 2.5],
					10, ['case', ['==', ['get', 'typ'], 'stay'], 8, 5]
				],
				'circle-color': ['case', ['==', ['get', 'typ'], 'stay'], ['get', 'farbe'], halo],
				'circle-stroke-color': ['case', ['==', ['get', 'typ'], 'stay'], halo, ['get', 'farbe']],
				'circle-stroke-width': ['case', ['==', ['get', 'typ'], 'stay'], 2.5, 2]
			}
		});
		bereit = true;
		hervorheben();
		onbereit?.();
	}

	function hervorheben() {
		if (!map || !bereit) return;
		const deck: maplibregl.ExpressionSpecification | number = auswahl ? ['case', ['==', ['get', 'reise'], auswahl], 1, 0.22] : 1;
		map.setPaintProperty('linien', 'line-opacity', deck);
		map.setPaintProperty('linien-gerade', 'line-opacity', deck);
		map.setPaintProperty('linien-halo', 'line-opacity', deck);
		map.setPaintProperty('punkte', 'circle-opacity', deck);
		map.setPaintProperty('punkte', 'circle-stroke-opacity', deck);
	}

	// --- Foto-Stapel ---
	let index: Supercluster | null = null;
	function fotosNeu() {
		index = new Supercluster({ radius: 60, maxZoom: 17 });
		index.load(
			fotos.map((f) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lng, f.lat] }, properties: { id: f.id, url: f.url } }))
		);
		fotosZeichnen();
	}
	function fotosZeichnen() {
		for (const m of fotoMarker) m.remove();
		fotoMarker = [];
		if (!map || !fotosAn || !index) return;
		const b = map.getBounds();
		const z = Math.round(map.getZoom());
		for (const c of index.getClusters([b.getWest() - 5, b.getSouth() - 5, b.getEast() + 5, b.getNorth() + 5], z)) {
			const [lng, lat] = c.geometry.coordinates as [number, number];
			const p = c.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; id?: string; url?: string };
			const el = document.createElement('button');
			el.className = 'fpin';
			if (p.cluster) {
				const erstes = index.getLeaves(p.cluster_id!, 1)[0];
				el.classList.add('stapel');
				el.innerHTML = `<img alt="" src="${(erstes.properties as { url: string }).url}"><span>${p.point_count}</span>`;
				el.setAttribute('aria-label', `${p.point_count} Fotos`);
				el.onclick = (e) => {
					e.stopPropagation();
					const zoom = index!.getClusterExpansionZoom(p.cluster_id!);
					map!.easeTo({ center: [lng, lat], zoom: Math.min(zoom, 17), duration: 700 });
				};
			} else {
				el.innerHTML = `<img alt="" src="${p.url}">`;
				el.setAttribute('aria-label', 'Foto ansehen');
				el.onclick = (e) => {
					e.stopPropagation();
					onfoto?.(p.id!);
				};
			}
			// Hülle, weil MapLibre die Position per transform setzt (die Einblend-Animation braucht ein eigenes Element)
			const huelle = document.createElement('div');
			huelle.appendChild(el);
			fotoMarker.push(new maplibregl.Marker({ element: huelle }).setLngLat([lng, lat]).addTo(map));
		}
	}

	maplibregl.setWorkerUrl(workerUrl);

	onMount(() => {
		let weg = false;
		kartenStil(farben).then((style) => {
			if (weg) return;
			map = new maplibregl.Map({
				container: box,
				style,
				center: [10, 50],
				zoom: 3.2,
				attributionControl: { compact: true },
				dragRotate: false,
				pitchWithRotate: false
			});
			map.touchZoomRotate.disableRotation();
			map.on('style.load', ebenenAnlegen);
			map.on('moveend', fotosZeichnen);
			map.on('click', 'punkte', (e) => {
				const id = e.features?.[0]?.properties?.id;
				if (id) onpunkt?.(id);
			});
			map.on('click', 'linien', (e) => {
				const r = e.features?.[0]?.properties?.reise;
				if (r) onreise?.(r);
			});
			map.on('click', 'linien-gerade', (e) => {
				const r = e.features?.[0]?.properties?.reise;
				if (r) onreise?.(r);
			});
			for (const id of ['punkte', 'linien', 'linien-gerade']) {
				map.on('mouseenter', id, () => map && (map.getCanvas().style.cursor = 'pointer'));
				map.on('mouseleave', id, () => map && (map.getCanvas().style.cursor = ''));
			}
		});
		return () => {
			weg = true;
			map?.remove();
		};
	});

	// Hell/Dunkel: Stil tauschen, Kamera bleibt
	// svelte-ignore state_referenced_locally
	let ersteFarben = farben;
	$effect(() => {
		const f = farben;
		if (!map || f === ersteFarben) return;
		ersteFarben = f;
		bereit = false;
		kartenStil(f).then((s) => map?.setStyle(s));
	});

	// Daten- und Auswahländerungen nachziehen
	$effect(() => {
		const l = linien,
			p = punkte;
		if (!map || !bereit) return;
		(map.getSource('linien') as GeoJSONSource)?.setData(l);
		(map.getSource('punkte') as GeoJSONSource)?.setData(p);
	});
	$effect(() => {
		void auswahl;
		hervorheben();
	});
	$effect(() => {
		void fotos;
		void fotosAn;
		if (map) fotosNeu();
	});
	$effect(() => {
		if (!map) return;
		if (!ich) {
			ichMarker?.remove();
			ichMarker = null;
			return;
		}
		if (!ichMarker) {
			const el = document.createElement('div');
			el.className = 'ich';
			ichMarker = new maplibregl.Marker({ element: el }).setLngLat([ich.lng, ich.lat]).addTo(map);
		} else ichMarker.setLngLat([ich.lng, ich.lat]);
	});
</script>

<div class="karte" bind:this={box}></div>

<style>
	.karte {
		position: absolute;
		inset: 0;
		background: var(--grund);
	}
	:global(.fpin) {
		position: relative;
		display: block;
		width: 46px;
		height: 46px;
		padding: 0;
		border: 2.5px solid var(--flaeche);
		border-radius: 50%;
		overflow: visible;
		background: var(--flaeche);
		box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
		cursor: pointer;
		animation: fpin-rein 0.35s var(--sanft);
	}
	:global(.fpin img) {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
		display: block;
	}
	:global(.fpin.stapel) {
		width: 54px;
		height: 54px;
		box-shadow:
			4px -3px 0 -1px var(--flaeche),
			4px -3px 0 1px var(--linie),
			0 4px 12px rgba(0, 0, 0, 0.28);
	}
	:global(.fpin span) {
		position: absolute;
		right: -6px;
		bottom: -4px;
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		border-radius: 11px;
		background: var(--signal);
		color: var(--signal-text);
		font: 650 12px/22px var(--schrift);
		font-variant-numeric: tabular-nums;
	}
	:global(.ich) {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #2f7cf6;
		border: 3px solid #fff;
		box-shadow:
			0 0 0 6px rgba(47, 124, 246, 0.2),
			0 2px 6px rgba(0, 0, 0, 0.3);
	}
	@keyframes fpin-rein {
		from {
			transform: scale(0.6);
			opacity: 0;
		}
	}
	:global(.maplibregl-ctrl-attrib) {
		font: 11px var(--schrift);
	}
	:global(.maplibregl-ctrl-attrib.maplibregl-compact) {
		background: var(--flaeche);
		color: var(--text-2);
	}
</style>
