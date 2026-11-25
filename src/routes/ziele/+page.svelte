<!-- Merkliste / Planung: Ziele für bestimmte Reisen oder „irgendwann“. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import Plus from 'phosphor-svelte/lib/Plus';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import Reiter from '#lib/ui/Reiter.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { thema } from '#lib/thema.svelte.ts';
	import { zielFarbe } from '#lib/map/zusatz.ts';
	import { abstand } from '#lib/geo.ts';
	import { heute } from '#lib/datum.ts';
	import { ungefaehrHier, zieleInDerNaehe, entfernungText } from '#lib/unterwegs.ts';
	import { ZIEL_ART, type Ziel } from '#lib/db/typen.ts';

	let erledigteOffen = $state(false);

	const offen = $derived(daten.ziele.filter((z) => !z.erledigt));
	const erledigt = $derived(daten.ziele.filter((z) => z.erledigt));
	// Gruppen: geplante Reisen (nach Start), dann „Irgendwann“
	const gruppen = $derived.by(() => {
		const nachReise = new Map<string, Ziel[]>();
		for (const z of offen) nachReise.set(z.reise ?? '', [...(nachReise.get(z.reise ?? '') ?? []), z]);
		const liste = [...nachReise.entries()]
			.filter(([r]) => r)
			.map(([r, ziele]) => ({ titel: `Für „${daten.reise(r)?.titel ?? 'Reise'}“`, start: daten.reise(r)?.start ?? '', ziele }))
			.sort((a, b) => a.start.localeCompare(b.start));
		if (nachReise.get('')?.length) liste.push({ titel: 'Irgendwann', start: '', ziele: nachReise.get('')! });
		return liste;
	});

	onMount(() => {
		ui.auswahl = null;
		const k = daten.ziele.filter((z) => !z.erledigt).map((z) => [z.ort.lng, z.ort.lat] as [number, number]);
		if (k.length) setTimeout(() => ui.karte?.zeigeBereich(k, ui.rand(), 12), 100);
	});

	// Entfernung: GPS, sonst (während einer Reise) von der aktuellen Übernachtung aus
	const hier = $derived(ungefaehrHier());
	const entfernung = (z: Ziel) => (hier ? entfernungText(abstand(hier, z.ort)) : '');
	const nahe = $derived(zieleInDerNaehe());
	const oeffnen = (z: Ziel) => {
		ui.zeigeOrt(z.ort, 13);
		ui.dialog = { art: 'ziel', id: z.id };
	};
</script>

<Reiter />

<div class="seite">
	<button class="knopf neu" onclick={() => (ui.dialog = { art: 'ziel', vorlage: {} })}><Plus size={18} weight="bold" /> Ziel merken</button>

	{#if !daten.ziele.length}
		<p class="leer">
			Sammle hier Orte, an die du willst: Stellplätze, Städte, Sehenswürdigkeiten, Wanderungen, Restaurants. Per Suche, per langem Drücken auf die Karte
			oder mit einem Park4Night-Link – und ordne sie einer geplanten Reise zu.
		</p>
	{/if}

	{#if nahe.length}
		<h4>In der Nähe</h4>
		<ul class="ziele">
			{#each nahe as { ziel: z, m } (z.id)}
				<li>
					<button onclick={() => oeffnen(z)}>
						<span class="punkt" style:background={zielFarbe(z.art, thema.dunkel)}></span>
						<span class="z-txt">
							<b>{z.name}</b>
							<span>{ZIEL_ART[z.art]}{z.reise ? ` · für „${daten.reise(z.reise)?.titel ?? 'Reise'}“` : ''}</span>
						</span>
						<span class="weit zahl">{entfernungText(m)}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#each gruppen as g (g.titel)}
		<h4>{g.titel}</h4>
		<ul class="ziele">
			{#each g.ziele as z (z.id)}
				<li>
					<button onclick={() => oeffnen(z)}>
						<span class="punkt" style:background={zielFarbe(z.art, thema.dunkel)}></span>
						<span class="z-txt">
							<b>{z.name}</b>
							<span>{ZIEL_ART[z.art]}{z.ort.name && z.ort.name !== z.name ? ` · ${z.ort.name}` : ''}{entfernung(z) ? ` · ${entfernung(z)}` : ''}</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/each}

	{#if erledigt.length}
		<button class="aufklapp" onclick={() => (erledigteOffen = !erledigteOffen)} aria-expanded={erledigteOffen}>
			<CaretDown size={16} style="transform: rotate({erledigteOffen ? 180 : 0}deg); transition: transform .2s" />
			Erledigt ({erledigt.length})
		</button>
		{#if erledigteOffen}
			<ul class="ziele" transition:slide={{ duration: 180 }}>
				{#each erledigt as z (z.id)}
					<li class="fertig">
						<button onclick={() => oeffnen(z)}>
							<CheckCircle size={18} weight="fill" />
							<span class="z-txt"><b>{z.name}</b><span>{ZIEL_ART[z.art]} · erledigt {z.erledigt === heute() ? 'heute' : ''}</span></span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<style>
	.seite {
		padding: 0 18px;
	}
	.neu {
		width: 100%;
		margin: 2px 0 6px;
	}
	h4 {
		margin: 20px 0 6px;
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-2);
	}
	.ziele {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ziele button {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 58px;
		padding: 8px 0;
		border: 0;
		border-bottom: 1px solid var(--linie);
		background: none;
		text-align: left;
	}
	.punkt {
		flex: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid var(--flaeche);
		box-shadow: 0 0 0 1px var(--linie);
	}
	.z-txt {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.z-txt b {
		font-weight: 620;
	}
	.z-txt span {
		font-size: 13px;
		color: var(--text-2);
	}
	.weit {
		flex: none;
		color: var(--text-2);
		font-size: 13px;
	}
	.fertig {
		color: var(--stern);
	}
	.fertig .z-txt b {
		color: var(--text-2);
		text-decoration: line-through;
	}
	.aufklapp {
		margin-top: 16px;
	}
</style>
