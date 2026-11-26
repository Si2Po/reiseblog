<!-- Alle Stellplätze, sortiert nach Bewertung oder Entfernung, mit Filtern. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Reiter from '#lib/ui/Reiter.svelte';
	import Sterne from '#lib/ui/Sterne.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { besuche, platzBewertung } from '#lib/auswertung.ts';
	import { AUSSTATTUNG } from '#lib/merkmale.ts';
	import { PLATZ_ART, type Merkmale, type Platz, type PlatzArt } from '#lib/db/typen.ts';
	import Funnel from 'phosphor-svelte/lib/Funnel';
	import Dialog from '#lib/ui/Dialog.svelte';
	import SterneWahl from '#lib/ui/SterneWahl.svelte';
	import MerkmalFelder from '#lib/formulare/MerkmalFelder.svelte';
	import { thema } from '#lib/thema.svelte.ts';
	import { bewertungsFarbe, BEWERTUNG_LEGENDE } from '#lib/map/zusatz.ts';
	import { abstand, standort } from '#lib/geo.ts';
	import { zahl } from '#lib/datum.ts';

	onMount(() => {
		ui.auswahl = null;
		ui.markiert = null;
		const k = daten.plaetze.map((p) => [p.ort.lng, p.ort.lat] as [number, number]);
		if (k.length) setTimeout(() => ui.karte?.zeigeBereich(k, ui.rand(), 12), 100);
		return () => (ui.sichtbarePlaetze = null);
	});

	// Filter: Schnellwahl + alle Merkmale aus dem Katalog (Dialog „Filter“)
	let schnell = $state<string[]>([]);
	let merkmale = $state<Merkmale>({});
	let arten = $state<PlatzArt[]>([]);
	let minSterne = $state<number | undefined>();
	let filterOffen = $state(false);
	let sortierung = $state<'bewertung' | 'naehe'>('bewertung');
	const SCHNELL = [
		{ key: 'top', name: '4+ Sterne' },
		{ key: 'gratis', name: 'Gratis' }
	];
	const passtSchnell = (p: Platz, f: string) => (f === 'top' ? platzBewertung(p.id) >= 4 : besuche(p.id).some((b) => b.preis === 0));
	const passtMerkmale = (p: Platz) => Object.entries(merkmale).every(([k, w]) => p.merkmale[k] === w);
	const anzahlFilter = $derived(Object.keys(merkmale).length + arten.length + (minSterne ? 1 : 0));

	const liste = $derived(
		daten.plaetze
			.filter((p) => schnell.every((f) => passtSchnell(p, f)) && passtMerkmale(p))
			.filter((p) => !arten.length || arten.includes(p.art))
			.filter((p) => !minSterne || platzBewertung(p.id) >= minSterne)
			.map((p) => ({ p, wert: platzBewertung(p.id), weg: ui.ich ? abstand(ui.ich, p.ort) : 0 }))
			.sort((a, b) => (sortierung === 'naehe' && ui.ich ? a.weg - b.weg : b.wert - a.wert || a.p.name.localeCompare(b.p.name)))
	);
	// Karte zeigt nur die gefilterten Plätze
	$effect(() => {
		const gefiltert = schnell.length || anzahlFilter;
		ui.sichtbarePlaetze = gefiltert ? liste.map((x) => x.p.id) : null;
	});
	const umschalten = (k: string) => (schnell = schnell.includes(k) ? schnell.filter((f) => f !== k) : [...schnell, k]);
	const artUmschalten = (k: PlatzArt) => (arten = arten.includes(k) ? arten.filter((a) => a !== k) : [...arten, k]);
	function zuruecksetzen() {
		merkmale = {};
		arten = [];
		minSterne = undefined;
		schnell = [];
	}

	async function nachNaehe() {
		if (sortierung === 'naehe') return (sortierung = 'bewertung');
		try {
			if (!ui.ich) {
				const pos = await standort();
				ui.ich = { lat: pos.coords.latitude, lng: pos.coords.longitude, genau: pos.coords.accuracy };
			}
			sortierung = 'naehe';
		} catch (e) {
			ui.zeige((e as Error).message);
		}
	}
	const entfernung = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${zahl(Math.round(m / 1000))} km`);
</script>

<Reiter />

<div class="seite">
	{#if daten.plaetze.length}
		<div class="chips rand">
			<button class:an={anzahlFilter > 0} onclick={() => (filterOffen = true)}><Funnel size={15} /> Filter{anzahlFilter ? ` (${anzahlFilter})` : ''}</button>
			<button class:an={sortierung === 'naehe'} onclick={nachNaehe}>In der Nähe</button>
			{#each SCHNELL as f (f.key)}
				<button class:an={schnell.includes(f.key)} onclick={() => umschalten(f.key)}>{f.name}</button>
			{/each}
		</div>
		<div class="legende">
			{#each BEWERTUNG_LEGENDE as l (l.name)}
				<span><i style:background={bewertungsFarbe(l.wert, thema.dunkel)}></i>{l.name}</span>
			{/each}
			<span class="anzahl zahl">{liste.length} von {daten.plaetze.length}</span>
		</div>
	{/if}

	{#if filterOffen}
		<Dialog titel="Plätze filtern" onschliessen={() => (filterOffen = false)}>
			<div class="feld">
				<span class="name">Mindestens</span>
				<SterneWahl bind:wert={minSterne} name="Mindestbewertung" />
			</div>
			<div class="feld">
				<span class="name">Art</span>
				<div class="chips umbruch">
					{#each Object.entries(PLATZ_ART) as [k, n] (k)}
						<button type="button" class:an={arten.includes(k as PlatzArt)} onclick={() => artUmschalten(k as PlatzArt)}>{n}</button>
					{/each}
				</div>
			</div>
			<MerkmalFelder bezug="platz" bind:werte={merkmale} />
			{#snippet fuss()}
				<button class="knopf zweit" onclick={zuruecksetzen}>Zurücksetzen</button>
				<button class="knopf" onclick={() => (filterOffen = false)}>{liste.length} {liste.length === 1 ? 'Platz' : 'Plätze'} zeigen</button>
			{/snippet}
		</Dialog>
	{/if}
	<ul class="plaetze">
		{#each liste as { p, wert, weg } (p.id)}
			<li>
				<a href="#/platz/{p.id}">
					<span class="p-txt">
						<b>{p.name}</b>
						<span>{PLATZ_ART[p.art]}{#if p.ort.name}{' · '}{p.ort.name}{/if}{#if sortierung === 'naehe' && ui.ich}{' · '}{entfernung(weg)}{/if}</span>
					</span>
					<span class="p-rechts">
						{#if wert}<Sterne {wert} groesse={12} />{/if}
						<span class="mini">
							{#each AUSSTATTUNG.filter((a) => p.merkmale[a.key]).slice(0, 5) as a (a.key)}{#if a.icon}<a.icon size={13} />{/if}{/each}
						</span>
					</span>
				</a>
			</li>
		{:else}
			<li class="leer">
				{#if daten.plaetze.length}Kein Platz passt zu allen Filtern.{:else}Hier sammeln sich alle Plätze, an denen du übernachtet hast – mit Bewertung und
					Ausstattung.{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.seite {
		padding: 0 18px;
	}
	.rand {
		margin: 2px -18px 8px;
		padding: 0 18px;
	}
	.chips.umbruch {
		flex-wrap: wrap;
	}
	.legende {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		margin-bottom: 4px;
		font-size: 12px;
		color: var(--text-2);
	}
	.legende span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.legende i {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	.legende .anzahl {
		margin-left: auto;
	}
	.plaetze {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.plaetze a {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 62px;
		padding: 8px 0;
		border-bottom: 1px solid var(--linie);
		color: inherit;
		text-decoration: none;
	}
	.p-txt {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.p-txt b {
		font-weight: 620;
	}
	.p-txt span {
		font-size: 13px;
		color: var(--text-2);
	}
	.p-rechts {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}
	.mini {
		display: flex;
		gap: 3px;
		color: var(--text-2);
	}
</style>
