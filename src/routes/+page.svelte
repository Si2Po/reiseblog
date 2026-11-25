<!-- Startseite: alle Reisen als große Bildkarten. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Plus from 'phosphor-svelte/lib/Plus';
	import Van from 'phosphor-svelte/lib/Van';
	import Reiter from '#lib/ui/Reiter.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { thema } from '#lib/thema.svelte.ts';
	import { reiseFarbe } from '#lib/farben.ts';
	import { reisenSortiert, naechte, km, fotosVon, reiseEnde, summe } from '#lib/auswertung.ts';
	import { zeitraum, jahr, zahl } from '#lib/datum.ts';
	import { beispielLaden } from '#lib/beispiel/daten.ts';

	const reisen = $derived(reisenSortiert());
	const s = $derived(summe());

	onMount(() => {
		// Gast-Ansicht: „Reisen“ ist die geteilte Übersicht
		if (daten.gast && ui.gastStart) return goto(ui.gastStart);
		ui.auswahl = null;
		ui.markiert = null;
		if (daten.geladen) ui.zeigeAlles();
	});

	function titelbild(id: string) {
		const r = daten.reise(id);
		return daten.foto(r?.titelbild)?.vorschau ?? fotosVon(id)[0]?.vorschau;
	}
</script>

<Reiter />

<div class="seite">
	{#if !daten.geladen}
		<p class="leer">Lädt …</p>
	{:else if !reisen.length}
		<div class="willkommen">
			<span class="symbol"><Van size={40} weight="duotone" /></span>
			<h2>Deine erste Reise</h2>
			<p>
				Leg eine Reise an und trag unterwegs Übernachtungen, Fahrten, Ausflüge und Fotos ein. Mit „Hier eintragen“ geht
				das direkt mit deinem Standort.
			</p>
			<button class="knopf" onclick={() => (ui.dialog = { art: 'reise' })}><Plus size={18} weight="bold" /> Neue Reise</button>
			<button class="knopf still" onclick={beispielLaden}>Zum Ausprobieren: Beispielreisen laden</button>
		</div>
	{:else}
		<p class="ueber summe zahl">
			{s.reisen}
			{s.reisen === 1 ? 'Reise' : 'Reisen'} · {s.naechte} Nächte · {zahl(s.km)} km
		</p>
		<div class="reisen">
			{#each reisen as r (r.id)}
				{@const bild = titelbild(r.id)}
				<a class="reise" class:ohne-bild={!bild} href="#/reise/{r.id}" style="--rf:{reiseFarbe(r.farbe, thema.dunkel)}">
					{#if bild}<img class="cover" alt="" src={bild} />{/if}
					<span class="r-txt">
						<span class="jahr zahl">{jahr(r.start)}</span>
						<span class="r-titel">{r.titel}</span>
						<span class="zeit">{zeitraum(r.start, r.ende ?? reiseEnde(r))}</span>
						<span class="zahlen zahl">
							<span><b>{naechte(r.id)}</b> Nächte</span>
							<span><b>{zahl(km(r.id))}</b> km</span>
							<span><b>{fotosVon(r.id).length}</b> Fotos</span>
						</span>
					</span>
				</a>
			{/each}
		</div>
		<button class="neue-reise" onclick={() => (ui.dialog = { art: 'reise' })}><Plus size={18} /> Neue Reise</button>
	{/if}
</div>

<style>
	.seite {
		padding: 4px 18px 0;
	}
	.summe {
		margin: 4px 0 12px;
	}
	.reisen {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.reise {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		height: 200px;
		border-radius: var(--radius-gross);
		overflow: hidden;
		color: #fff;
		text-decoration: none;
		background: var(--flaeche-2);
		transition: transform 0.2s var(--sanft);
	}
	.reise:active {
		transform: scale(0.985);
	}
	.cover {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.r-txt {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		padding: 56px 16px 14px;
		background: linear-gradient(transparent, rgba(6, 10, 8, 0.84));
	}
	/* Ohne Foto: Fläche in Reisefarbe statt Bild */
	.ohne-bild {
		height: 150px;
		background: linear-gradient(135deg, color-mix(in srgb, var(--rf) 85%, #000), color-mix(in srgb, var(--rf) 55%, #000));
	}
	.ohne-bild .r-txt {
		background: none;
		padding-top: 16px;
	}
	.jahr {
		align-self: flex-start;
		margin-bottom: 6px;
		padding: 2px 8px;
		border-radius: 4px;
		background: var(--rf);
		color: var(--schild-text);
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 0.08em;
	}
	.ohne-bild .jahr {
		background: rgba(255, 255, 255, 0.2);
		color: #fff;
	}
	.r-titel {
		font-size: 28px;
		font-weight: var(--kopf-gewicht);
		letter-spacing: var(--kopf-sperrung);
		line-height: 1.1;
	}
	.zeit {
		color: rgba(255, 255, 255, 0.78);
		font-size: 14px;
	}
	.zahlen {
		display: flex;
		gap: 12px;
		margin-top: 4px;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.78);
	}
	.zahlen b {
		color: #fff;
		font-size: 15px;
		font-weight: 650;
	}
	.neue-reise {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		height: 50px;
		margin-top: 14px;
		border: 1.5px dashed var(--linie);
		border-radius: var(--radius);
		background: none;
		color: var(--text-2);
		font-weight: 550;
	}
	.willkommen {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding: 18px 4px 10px;
	}
	.willkommen .symbol {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: var(--radius-gross);
		background: var(--signal);
		color: var(--signal-text);
	}
	.willkommen h2 {
		font-size: 28px;
	}
	.willkommen p {
		color: var(--text-2);
		line-height: 1.5;
	}
	.willkommen .knopf {
		width: 100%;
	}
</style>
