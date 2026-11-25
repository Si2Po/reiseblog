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
	import { kartenStil, kartenSpeicherLeeren, type KartenFarben } from './stil.ts';

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
		onbereit,
		onlang,
		onleer,
		pin = null,
		gedimmt = false,
		onkartenfehler,
		extra = { type: 'FeatureCollection', features: [] },
		onextra,
		laender = null
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
		/** langes Drücken (iPhone) bzw. Rechtsklick (PC) auf einen beliebigen Punkt */
		onlang?: (o: { lat: number; lng: number }) => void;
		/** Tipp auf eine freie Stelle der Karte */
		onleer?: () => void;
		/** Stecknadel (nach langem Drücken) */
		pin?: { lat: number; lng: number } | null;
		/** Routen und Punkte blass darstellen (z. B. beim „Ort wählen“) */
		gedimmt?: boolean;
		/** Kacheln laden auch nach dem Neuladen nicht */
		onkartenfehler?: () => void;
		/** Zusatz-Punkte (Plätze, Ziele): properties { id, name, farbe, ring? } */
		extra?: FC;
		onextra?: (id: string) => void;
		/** Länder einfärben (Statistik): Ländergrenzen + Codes der besuchten Länder */
		laender?: { grenzen: FC; besucht: string[]; farbe: string } | null;
	} = $props();

	let box: HTMLDivElement;
	let map: maplibregl.Map | undefined = $state();
	let bereit = $state(false);
	let fotoMarker: maplibregl.Marker[] = [];
	let ichMarker: maplibregl.Marker | null = null;
	let pinMarker: maplibregl.Marker | null = null;

	// --- langes Drücken auf dem iPhone (MapLibre meldet das nicht von selbst) ---
	let druck: { timer: ReturnType<typeof setTimeout>; x: number; y: number } | null = null;
	function druckStart(e: maplibregl.MapTouchEvent) {
		druckEnde();
		if (e.originalEvent.touches.length !== 1) return;
		const { lng, lat } = e.lngLat;
		druck = {
			x: e.point.x,
			y: e.point.y,
			timer: setTimeout(() => {
				druck = null;
				onlang?.({ lat, lng });
			}, 550)
		};
	}
	function druckBewegt(e: maplibregl.MapTouchEvent) {
		if (druck && Math.hypot(e.point.x - druck.x, e.point.y - druck.y) > 10) druckEnde();
	}
	function druckEnde() {
		if (druck) clearTimeout(druck.timer);
		druck = null;
	}

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
		// Zusatz-Ebene: Plätze (nach Bewertung gefärbt) bzw. Ziele der Merkliste, mit Namen
		map.addSource('extra', { type: 'geojson', data: extra });
		map.addLayer({
			id: 'extra',
			type: 'circle',
			source: 'extra',
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 10, 9, 14, 11],
				'circle-color': ['get', 'farbe'],
				'circle-stroke-color': ['case', ['to-boolean', ['get', 'ring']], ['get', 'ring'], halo],
				'circle-stroke-width': ['case', ['to-boolean', ['get', 'ring']], 3.5, 2.5]
			}
		});
		map.addLayer({
			id: 'extra-name',
			type: 'symbol',
			source: 'extra',
			minzoom: 7,
			layout: {
				'text-field': ['get', 'name'],
				'text-font': ['Noto Sans Bold'],
				'text-size': 12,
				'text-offset': [0, 1.3],
				'text-anchor': 'top',
				'text-max-width': 9,
				'text-optional': true
			},
			paint: { 'text-color': farben.textStark, 'text-halo-color': halo, 'text-halo-width': 1.6 }
		});
		bereit = true;
		hervorheben();
		onbereit?.();
	}

	function hervorheben() {
		if (!map || !bereit) return;
		const deck: maplibregl.ExpressionSpecification | number = gedimmt ? 0.15 : auswahl ? ['case', ['==', ['get', 'reise'], auswahl], 1, 0.22] : 1;
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

	// Selbstheilung: Häufen sich Kachel-Fehler (z. B. veraltete Kachel-Übersicht im Speicher),
	// Karten-Zwischenspeicher leeren und den Stil einmal frisch laden.
	let fehlerZahl = 0;
	let geheilt = false;
	async function kachelFehler(e: maplibregl.ErrorEvent & { sourceId?: string; tile?: unknown }) {
		if (e.sourceId !== 'openmaptiles' || !navigator.onLine) return;
		// Einzelne Kachel: erst nach mehreren Fehlern eingreifen. Kachel-Übersicht (kein `tile`): sofort –
		// so sieht es aus, wenn ein Blocker (z. B. Brave Shields) die Karte sperrt.
		if (e.tile && ++fehlerZahl < 4) return;
		fehlerZahl = 0;
		if (geheilt) return onkartenfehler?.();
		geheilt = true;
		await kartenSpeicherLeeren();
		bereit = false;
		map?.setStyle(await kartenStil(farben));
	}

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
			map.on('error', kachelFehler);
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
			map.on('click', 'extra', (e) => {
				const id = e.features?.[0]?.properties?.id;
				if (id) onextra?.(id);
			});
			for (const id of ['punkte', 'linien', 'linien-gerade', 'extra']) {
				map.on('mouseenter', id, () => map && (map.getCanvas().style.cursor = 'pointer'));
				map.on('mouseleave', id, () => map && (map.getCanvas().style.cursor = ''));
			}
			// Langes Drücken (iPhone) bzw. Rechtsklick (PC): beliebigen Ort wählen
			map.on('touchstart', druckStart);
			map.on('touchmove', druckBewegt);
			for (const ev of ['touchend', 'touchcancel', 'dragstart', 'zoomstart', 'pitchstart'] as const) map.on(ev, druckEnde);
			map.on('contextmenu', (e) => {
				e.preventDefault();
				onlang?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
			});
			// Tipp ins Leere (nicht auf Route/Punkt)
			map.on('click', (e) => {
				if (!map) return;
				const da = map.queryRenderedFeatures(e.point, { layers: ['punkte', 'linien', 'linien-gerade', 'extra'].filter((l) => map!.getLayer(l)) });
				if (!da.length) onleer?.();
			});
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
		const x = extra;
		if (!map || !bereit) return;
		(map.getSource('extra') as GeoJSONSource)?.setData(x);
	});
	// Statistik: besuchte Länder einfärben (Ebene liegt unter den Routen)
	$effect(() => {
		const l = laender;
		if (!map || !bereit) return;
		if (!l) {
			if (map.getLayer('laender')) map.setLayoutProperty('laender', 'visibility', 'none');
			if (map.getLayer('laender-rand')) map.setLayoutProperty('laender-rand', 'visibility', 'none');
			return;
		}
		if (!map.getSource('laender')) {
			map.addSource('laender', { type: 'geojson', data: l.grenzen });
			map.addLayer({ id: 'laender', type: 'fill', source: 'laender', paint: { 'fill-color': l.farbe, 'fill-opacity': 0.45 } }, 'linien-halo');
			map.addLayer({ id: 'laender-rand', type: 'line', source: 'laender', paint: { 'line-color': l.farbe, 'line-width': 1.2 } }, 'linien-halo');
		}
		const filter: maplibregl.FilterSpecification = ['in', ['get', 'c'], ['literal', l.besucht]];
		map.setFilter('laender', filter);
		map.setFilter('laender-rand', filter);
		map.setPaintProperty('laender', 'fill-color', l.farbe);
		map.setPaintProperty('laender-rand', 'line-color', l.farbe);
		map.setLayoutProperty('laender', 'visibility', 'visible');
		map.setLayoutProperty('laender-rand', 'visibility', 'visible');
	});
	$effect(() => {
		void auswahl;
		void gedimmt;
		hervorheben();
	});
	$effect(() => {
		if (!map) return;
		if (!pin) {
			pinMarker?.remove();
			pinMarker = null;
			return;
		}
		if (!pinMarker) {
			// äußeres Element positioniert MapLibre, das innere wird animiert
			const el = document.createElement('div');
			el.innerHTML = '<div class="pin"><svg viewBox="0 0 40 52" width="40" height="52"><path d="M20 2C10 2 2 10 2 20c0 13 18 30 18 30s18-17 18-30C38 10 30 2 20 2z"/><circle cx="20" cy="20" r="7"/></svg></div>';
			pinMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([pin.lng, pin.lat]).addTo(map);
		} else pinMarker.setLngLat([pin.lng, pin.lat]);
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
		/* kein iOS-Menü/Textauswahl beim langen Drücken */
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
	}
	:global(.pin) {
		filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.35));
		animation: pin-rein 0.35s var(--sanft);
	}
	:global(.pin svg path) {
		fill: var(--signal);
		stroke: #111;
		stroke-width: 2;
	}
	:global(.pin svg circle) {
		fill: #111;
	}
	@keyframes pin-rein {
		from {
			transform: translateY(-24px);
			opacity: 0;
		}
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
