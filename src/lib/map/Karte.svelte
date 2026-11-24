<!--
  Karte mit MapLibre: Routen und Punkte als GeoJSON-Ebenen,
  Fotos als runde Vorschaubilder (nahe beieinander → Stapel mit Anzahl).
-->
<script lang="ts" module>
	export interface KartenFoto {
		id: string;
		lat: number;
		lng: number;
		url: string;
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
		onpunkt?: (id: string) => void;
		onreise?: (id: string) => void;
		onfoto?: (id: string) => void;
		onbereit?: () => void;
	} = $props();

	let box: HTMLDivElement;
	let map: maplibregl.Map | undefined = $state();
	let bereit = $state(false);
	let fotoMarker: maplibregl.Marker[] = [];

	// --- von außen aufrufbar ---
	export function zeigeBereich(coords: [number, number][], unten: number) {
		if (!map || !coords.length) return;
		const b = new maplibregl.LngLatBounds(coords[0], coords[0]);
		for (const c of coords) b.extend(c);
		map.fitBounds(b as LngLatBoundsLike, {
			padding: { top: 90, bottom: unten + 40, left: 40, right: 40 },
			duration: 1400,
			maxZoom: 11,
			essential: true
		});
	}
	export function zeigePunkt(lng: number, lat: number, unten: number, zoom = 12) {
		map?.flyTo({ center: [lng, lat], zoom, padding: { top: 60, bottom: unten, left: 0, right: 0 }, duration: 1400, essential: true });
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
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': ['get', 'farbe'], 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.4, 10, 4.5] }
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
		for (const id of ['punkte', 'linien']) {
			map.on('mouseenter', id, () => map && (map.getCanvas().style.cursor = 'pointer'));
			map.on('mouseleave', id, () => map && (map.getCanvas().style.cursor = ''));
		}
		bereit = true;
		hervorheben();
		onbereit?.();
	}

	function hervorheben() {
		if (!map || !bereit) return;
		const deck: maplibregl.ExpressionSpecification | number = auswahl ? ['case', ['==', ['get', 'reise'], auswahl], 1, 0.22] : 1;
		map.setPaintProperty('linien', 'line-opacity', deck);
		map.setPaintProperty('linien-halo', 'line-opacity', deck);
		map.setPaintProperty('punkte', 'circle-opacity', deck);
		map.setPaintProperty('punkte', 'circle-stroke-opacity', deck);
	}

	// --- Foto-Stapel ---
	let index: Supercluster | null = null;
	function fotosNeu() {
		index = new Supercluster({ radius: 56, maxZoom: 16 });
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
			let url = p.url;
			if (p.cluster) {
				const erstes = index.getLeaves(p.cluster_id!, 1)[0];
				url = (erstes.properties as { url: string }).url;
				el.classList.add('stapel');
				el.innerHTML = `<img alt="" src="${url}"><span>${p.point_count}</span>`;
				el.onclick = (e) => {
					e.stopPropagation();
					const zoom = index!.getClusterExpansionZoom(p.cluster_id!);
					map!.easeTo({ center: [lng, lat], zoom: Math.min(zoom, 16), duration: 700 });
				};
			} else {
				el.innerHTML = `<img alt="" src="${url}">`;
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
				center: [6, 54],
				zoom: 2.6,
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
		});
		return () => {
			weg = true;
			map?.remove();
		};
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
		animation: fpin-rein 0.35s cubic-bezier(0.22, 1, 0.36, 1);
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
		background: var(--akzent);
		color: var(--akzent-text);
		font: 650 12px/22px var(--schrift-ui);
		font-variant-numeric: tabular-nums;
	}
	@keyframes fpin-rein {
		from {
			transform: scale(0.6);
			opacity: 0;
		}
	}
	:global(.maplibregl-ctrl-attrib) {
		font: 11px var(--schrift-ui);
	}
</style>
