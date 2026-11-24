<!-- Alle Stellplätze, sortiert nach Bewertung oder Entfernung, mit Filtern. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Reiter from '#lib/ui/Reiter.svelte';
	import Sterne from '#lib/ui/Sterne.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { besuche, platzBewertung } from '#lib/auswertung.ts';
	import { AUSSTATTUNG } from '#lib/ausstattung.ts';
	import { PLATZ_ART } from '#lib/db/typen.ts';
	import { abstand, standort } from '#lib/geo.ts';
	import { zahl } from '#lib/datum.ts';

	onMount(() => {
		ui.auswahl = null;
		ui.markiert = null;
	});

	let filter = $state<string[]>([]);
	let sortierung = $state<'bewertung' | 'naehe'>('bewertung');
	const FILTER = [
		{ key: 'gern', name: 'Gern wieder' },
		{ key: 'gratis', name: 'Gratis' },
		{ key: 'strom', name: 'Strom' },
		{ key: 'hunde', name: 'Hunde' },
		{ key: 'dusche', name: 'Dusche' },
		{ key: 'frei', name: 'Frei stehen' }
	];
	const passt = (p: (typeof daten.plaetze)[number], f: string) =>
		f === 'gern'
			? p.wiederkommen
			: f === 'gratis'
				? besuche(p.id).some((b) => b.preis === 0)
				: f === 'frei'
					? p.art === 'frei'
					: p.ausstattung.includes(f);

	const liste = $derived(
		daten.plaetze
			.filter((p) => filter.every((f) => passt(p, f)))
			.map((p) => ({ p, wert: platzBewertung(p.id), weg: ui.ich ? abstand(ui.ich, p.ort) : 0 }))
			.sort((a, b) => (sortierung === 'naehe' && ui.ich ? a.weg - b.weg : b.wert - a.wert || a.p.name.localeCompare(b.p.name)))
	);
	const umschalten = (k: string) => (filter = filter.includes(k) ? filter.filter((f) => f !== k) : [...filter, k]);

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
			<button class:an={sortierung === 'naehe'} onclick={nachNaehe}>In der Nähe</button>
			{#each FILTER as f (f.key)}
				<button class:an={filter.includes(f.key)} onclick={() => umschalten(f.key)}>{f.name}</button>
			{/each}
		</div>
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
							{#each AUSSTATTUNG.filter((a) => p.ausstattung.includes(a.key)).slice(0, 5) as a (a.key)}<a.icon size={13} />{/each}
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
