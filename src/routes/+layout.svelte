<!--
  Grundgerüst der App: Karte als Hintergrund, darüber
  - am iPhone ein wischbares Sheet,
  - am PC (ab 900 px Breite) eine feste Seitenleiste links.
  Die Seiten (Reisen, Plätze, …) erscheinen im Sheet bzw. in der Leiste.
-->
<script lang="ts">
	import '@fontsource-variable/instrument-sans/index.css';
	import '#lib/styles/design.css';
	import '#lib/styles/grund.css';
	import type { LayoutProps } from './$types';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fade } from 'svelte/transition';
	import Plus from 'phosphor-svelte/lib/Plus';
	import Crosshair from 'phosphor-svelte/lib/Crosshair';
	import Karte from '#lib/map/Karte.svelte';
	import Kartenmenue from '#lib/map/Kartenmenue.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import Hinweis from '#lib/ui/Hinweis.svelte';
	import Grossansicht from '#lib/ui/Grossansicht.svelte';
	import NeueVersion from '#lib/ui/NeueVersion.svelte';
	import ReiseFormular from '#lib/formulare/ReiseFormular.svelte';
	import EintragFormular from '#lib/formulare/EintragFormular.svelte';
	import HierEintragen from '#lib/formulare/HierEintragen.svelte';
	import PlatzFormular from '#lib/formulare/PlatzFormular.svelte';
	import FreigabeFormular from '#lib/formulare/FreigabeFormular.svelte';
	import { abgleich } from '#lib/db/abgleich.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { thema } from '#lib/thema.svelte.ts';
	import { KARTE_DUNKEL, KARTE_HELL, halo, reiseFarbe } from '#lib/farben.ts';
	import { offeneRoutenNachtragen } from '#lib/geo/routen.ts';
	import { fotosHinzufuegen } from '#lib/fotos/import.ts';

	let { children }: LayoutProps = $props();
	let karte: ReturnType<typeof Karte> | undefined = $state();

	$effect(() => {
		ui.karte = karte ?? null;
	});
	$effect(() => thema.anwenden());

	onMount(() => {
		// Geteilter Link: keine eigenen Daten laden, nichts abgleichen
		if (!location.hash.startsWith('#/teilen/')) {
			daten.laden().then(() => {
				offeneRoutenNachtragen();
				abgleich.starten();
			});
			addEventListener('online', offeneRoutenNachtragen);
		}
		const breit = matchMedia('(min-width: 900px)');
		ui.breit = breit.matches;
		breit.addEventListener('change', (e) => (ui.breit = e.matches));
	});

	// Fotos per Drag & Drop (PC): Zuordnung zu Reise und Tag nach Aufnahmedatum
	let ziehtDatei = $state(false);
	function dragover(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files') || daten.gast) return;
		e.preventDefault();
		ziehtDatei = true;
	}
	function drop(e: DragEvent) {
		e.preventDefault();
		ziehtDatei = false;
		if (daten.gast) return;
		const dateien = [...(e.dataTransfer?.files ?? [])];
		const reise = page.route.id === '/reise/[id]' ? page.params.id : undefined;
		if (dateien.length) fotosHinzufuegen(dateien, { reise });
	}

	// --- Kartendaten aus den Einträgen ---
	const farbeVon = (reise: string) => reiseFarbe(daten.reise(reise)?.farbe ?? 0, thema.dunkel);
	const linien = $derived<GeoJSON.FeatureCollection>({
		type: 'FeatureCollection',
		features: daten.eintraege
			.filter((e) => e.typ === 'drive' && (e.route?.length || (e.von && e.nach)))
			.map((e) => ({
				type: 'Feature',
				properties: { id: e.id, reise: e.reise, farbe: farbeVon(e.reise), gerade: !e.route?.length },
				geometry: {
					type: 'LineString',
					coordinates: e.route?.length ? e.route : [[e.von!.lng, e.von!.lat], [e.nach!.lng, e.nach!.lat]]
				}
			}))
	});
	const punkte = $derived<GeoJSON.FeatureCollection>({
		type: 'FeatureCollection',
		features: daten.eintraege
			.filter((e) => e.typ !== 'drive' && e.ort)
			.map((e) => ({
				type: 'Feature',
				properties: { id: e.id, reise: e.reise, typ: e.typ, farbe: farbeVon(e.reise) },
				geometry: { type: 'Point', coordinates: [e.ort!.lng, e.ort!.lat] }
			}))
	});
	const kartenFotos = $derived(daten.fotos.filter((f) => f.ort).map((f) => ({ id: f.id, lat: f.ort!.lat, lng: f.ort!.lng, url: f.vorschau })));

	function punktGetippt(id: string) {
		const e = daten.eintrag(id);
		if (!e) return;
		const aufReise = page.route.id === '/reise/[id]' && page.params.id === e.reise;
		if (e.typ === 'stay' && e.platz && aufReise) goto(`#/platz/${e.platz}`);
		else {
			ui.markiert = e.id;
			goto(`#/reise/${e.reise}`);
			setTimeout(() => document.getElementById('e-' + e.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
		}
		ui.oeffnen();
	}

	function fotoGetippt(id: string) {
		const f = daten.foto(id);
		const ids = f?.reise ? daten.fotos.filter((x) => x.reise === f.reise && x.ort).sort((a, b) => a.aufgenommen.localeCompare(b.aufgenommen)).map((x) => x.id) : [id];
		ui.gross = { ids, i: Math.max(0, ids.indexOf(id)) };
	}

	// Fadenkreuz für „Ort auf der Karte wählen“: Mitte des sichtbaren Kartenbereichs
	const kreuz = $derived(
		ui.breit
			? { x: 400 + (innerWidth - 400) / 2, y: innerHeight / 2 }
			: { x: innerWidth / 2, y: (innerHeight - ui.sichtbar) / 2 + 20 }
	);
	function ortUebernehmen() {
		const o = ui.karte?.ortBei(kreuz.x, kreuz.y) ?? null;
		ui.ortWahl?.fertig(o);
	}

	const dialogOffen = $derived(!!ui.dialog);
</script>

<svelte:window ondragover={dragover} ondragleave={(e) => !e.relatedTarget && (ziehtDatei = false)} ondrop={drop} />

{#if ziehtDatei}
	<div class="ablage" transition:fade={{ duration: 120 }}>
		<p>Fotos loslassen – sie werden nach Aufnahmedatum der passenden Reise zugeordnet.</p>
	</div>
{/if}

<div class="app" class:breit={ui.breit}>
	<Karte
		bind:this={karte}
		farben={thema.dunkel ? KARTE_DUNKEL : KARTE_HELL}
		halo={halo(thema.dunkel)}
		{linien}
		{punkte}
		fotos={kartenFotos}
		fotosAn={ui.fotosAn}
		auswahl={ui.auswahl}
		ich={ui.ich}
		onpunkt={punktGetippt}
		onreise={(id) => goto(`#/reise/${id}`)}
		onfoto={fotoGetippt}
		onbereit={() => {
			if (ui.auswahl) ui.zeigeReise(ui.auswahl);
			else ui.zeigeAlles();
		}}
	/>

	{#if !ui.ortWahl && (ui.breit || ui.hoehe !== 'voll')}
		<div transition:fade={{ duration: 150 }}><Kartenmenue /></div>
	{/if}

	{#if ui.breit}
		<aside class="leiste">
			<div class="leiste-inhalt">{@render children()}</div>
		</aside>
	{:else}
		<Sheet bind:hoehe={ui.hoehe} bind:sichtbar={ui.sichtbar} klein={118}>
			{@render children()}
		</Sheet>
	{/if}

	{#if ui.ortWahl}
		<div class="kreuz" style:left="{kreuz.x}px" style:top="{kreuz.y}px" transition:fade={{ duration: 150 }}>
			<Crosshair size={44} weight="bold" />
		</div>
		<div class="wahlleiste" class:breit={ui.breit} transition:fade={{ duration: 150 }}>
			<p>Karte verschieben, bis das Kreuz auf dem Ort liegt.</p>
			<div class="wahlknoepfe">
				<button class="knopf zweit" onclick={() => ui.ortWahl?.fertig(null)}>Abbrechen</button>
				<button class="knopf" onclick={ortUebernehmen}>Ort übernehmen</button>
			</div>
		</div>
	{:else if !dialogOffen && !daten.gast && (ui.breit || ui.hoehe !== 'voll')}
		<button
			class="hier"
			class:breit={ui.breit}
			style:bottom={ui.breit ? undefined : `${ui.sichtbar + 14}px`}
			onclick={() => (ui.dialog = { art: 'hier' })}
			transition:fade={{ duration: 150 }}
		>
			<Plus size={20} weight="bold" />
			{ui.breit ? 'Eintragen' : 'Hier eintragen'}
		</button>
	{/if}

	{#if ui.dialog?.art === 'reise'}
		<ReiseFormular id={ui.dialog.id} />
	{:else if ui.dialog?.art === 'eintrag'}
		<EintragFormular id={ui.dialog.id} vorlage={ui.dialog.vorlage} />
	{:else if ui.dialog?.art === 'hier'}
		<HierEintragen />
	{:else if ui.dialog?.art === 'platz'}
		<PlatzFormular id={ui.dialog.id} />
	{:else if ui.dialog?.art === 'freigabe'}
		<FreigabeFormular token={ui.dialog.token} />
	{/if}

	<Hinweis />
	<Grossansicht />
	<NeueVersion />
</div>

<style>
	.app {
		position: fixed;
		inset: 0;
		overflow: hidden;
	}
	.ablage {
		position: fixed;
		inset: 12px;
		z-index: 80;
		display: grid;
		place-items: center;
		border: 3px dashed var(--signal);
		border-radius: var(--radius-gross);
		background: color-mix(in srgb, var(--grund) 85%, transparent);
		pointer-events: none;
	}
	.ablage p {
		max-width: 360px;
		font-size: 20px;
		font-weight: 650;
		text-align: center;
	}
	.leiste {
		position: absolute;
		z-index: 20;
		top: 0;
		left: 0;
		bottom: 0;
		width: var(--leiste-breite);
		background: var(--flaeche);
		box-shadow: var(--schatten-leiste);
	}
	.leiste-inhalt {
		height: 100%;
		overflow-y: auto;
		padding: 14px 0 40px;
	}
	.hier {
		position: absolute;
		z-index: 19;
		right: 14px;
		display: flex;
		align-items: center;
		gap: 8px;
		height: 50px;
		padding: 0 20px 0 16px;
		border: 0;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font-weight: 620;
		font-size: 16px;
		box-shadow: var(--knopf-schatten);
		transition: bottom 0.42s var(--sanft);
	}
	.hier.breit {
		right: 24px;
		bottom: 28px;
	}
	.hier:active {
		transform: scale(0.97);
	}
	.kreuz {
		position: absolute;
		z-index: 25;
		transform: translate(-50%, -50%);
		color: var(--text);
		filter: drop-shadow(0 0 2px var(--flaeche)) drop-shadow(0 0 4px var(--flaeche));
		pointer-events: none;
	}
	.wahlleiste {
		position: absolute;
		z-index: 30;
		left: 10px;
		right: 10px;
		bottom: calc(10px + env(safe-area-inset-bottom));
		padding: 14px;
		border-radius: var(--radius-gross);
		background: var(--flaeche);
		box-shadow: var(--schatten-dialog);
	}
	.wahlleiste.breit {
		left: calc(var(--leiste-breite) + 24px);
		right: auto;
		width: 420px;
		bottom: 24px;
	}
	.wahlleiste p {
		margin-bottom: 12px;
		color: var(--text-2);
		font-size: 15px;
	}
	.wahlknoepfe {
		display: flex;
		gap: 10px;
	}
	.wahlknoepfe .knopf {
		flex: 1;
	}
</style>
