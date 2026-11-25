<!--
  Fotoalbum: alle Fotos, nach Reisen gruppiert (neueste zuerst), dann „Ohne Reise“.
  Tippen öffnet die Großansicht – von dort „Zur Reise“ bzw. „Auf der Karte“.
  Fotos lassen sich hier auch ohne Reise hinzufügen: passt das Aufnahmedatum zu einer Reise,
  landen sie dort, sonst stehen sie für sich (Karte und Album).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Plus from 'phosphor-svelte/lib/Plus';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import Reiter from '#lib/ui/Reiter.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { reisenSortiert, reiseEnde } from '#lib/auswertung.ts';
	import { zeitraum, monatJahr, zahl } from '#lib/datum.ts';
	import { fotosWaehlen } from '#lib/fotos/import.ts';
	import type { Foto } from '#lib/db/typen.ts';

	const nachZeit = (a: Foto, b: Foto) => a.aufgenommen.localeCompare(b.aufgenommen);

	interface Gruppe {
		id: string;
		titel: string;
		unter: string;
		reise?: string;
		fotos: Foto[];
	}
	const gruppen = $derived.by((): Gruppe[] => {
		const liste: Gruppe[] = [];
		for (const r of reisenSortiert()) {
			const fotos = daten.fotos.filter((f) => f.reise === r.id).sort(nachZeit);
			if (fotos.length) liste.push({ id: r.id, titel: r.titel, unter: zeitraum(r.start, r.ende ?? reiseEnde(r)), reise: r.id, fotos });
		}
		// Fotos ohne (noch vorhandene) Reise: nach Monat, neueste zuerst
		const ohne = daten.fotos.filter((f) => !daten.reise(f.reise)).sort(nachZeit).reverse();
		const monate = new Map<string, Foto[]>();
		for (const f of ohne) monate.set(f.aufgenommen.slice(0, 7), [...(monate.get(f.aufgenommen.slice(0, 7)) ?? []), f]);
		for (const [m, fotos] of monate) liste.push({ id: 'ohne-' + m, titel: monatJahr(m + '-01'), unter: 'Ohne Reise', fotos: fotos.reverse() });
		return liste;
	});

	onMount(() => {
		ui.auswahl = null;
		ui.markiert = null;
		ui.fotosAn = true;
		if (daten.geladen) ui.zeigeAlles();
	});

	const ansehen = (g: Gruppe, i: number) => (ui.gross = { ids: g.fotos.map((f) => f.id), i });
</script>

<Reiter />

<div class="seite">
	<div class="kopf">
		<span class="ueber zahl">{zahl(daten.fotos.length)} {daten.fotos.length === 1 ? 'Foto' : 'Fotos'}</span>
		<button class="knopf zweit" onclick={() => fotosWaehlen()}><Plus size={18} weight="bold" /> Fotos hinzufügen</button>
	</div>

	{#if !daten.fotos.length}
		<p class="leer">
			Noch keine Fotos. Füge sie bei einer Reise hinzu oder hier: Fotos aus einer Reisezeit landen automatisch bei der Reise, alle anderen stehen für sich auf der
			Karte. Damit der Ort mitkommt, in der Fotoauswahl unter „Optionen“ den Standort einschalten.
		</p>
	{/if}

	{#each gruppen as g (g.id)}
		<section>
			{#if g.reise}
				<a class="gkopf" href="#/reise/{g.reise}">
					<span><b>{g.titel}</b><small>{g.unter} · {g.fotos.length} {g.fotos.length === 1 ? 'Foto' : 'Fotos'}</small></span>
					<CaretRight size={16} />
				</a>
			{:else}
				<div class="gkopf">
					<span><b>{g.titel}</b><small>{g.unter} · {g.fotos.length} {g.fotos.length === 1 ? 'Foto' : 'Fotos'}</small></span>
				</div>
			{/if}
			<div class="raster">
				{#each g.fotos as f, i (f.id)}
					<button onclick={() => ansehen(g, i)} aria-label="Foto ansehen"><img alt="" src={f.vorschau} loading="lazy" /></button>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.seite {
		padding: 4px 18px 24px;
	}
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin: 2px 0 8px;
	}
	.kopf .knopf {
		height: 38px;
		padding: 0 14px;
		font-size: 15px;
	}
	section {
		margin-top: 14px;
	}
	.gkopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-height: 44px;
		margin-bottom: 6px;
		color: var(--text);
		text-decoration: none;
	}
	.gkopf span {
		display: flex;
		flex-direction: column;
	}
	.gkopf b {
		font-size: 19px;
		font-weight: var(--kopf-gewicht);
		letter-spacing: var(--kopf-sperrung);
	}
	.gkopf small {
		color: var(--text-2);
		font-size: 13px;
	}
	.gkopf :global(svg) {
		flex: none;
		color: var(--text-2);
	}
	.raster {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 3px;
		border-radius: var(--radius);
		overflow: hidden;
	}
	.raster button {
		aspect-ratio: 1;
		padding: 0;
		border: 0;
		background: var(--flaeche-2);
	}
	.raster img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
