<!--
  Gast-Ansicht eines Teilen-Links: zeigt nur, was freigegeben ist, nur zum Ansehen.
  Die Daten liegen nur im Speicher; die eigenen Daten des Geräts werden nicht angefasst.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Eye from 'phosphor-svelte/lib/Eye';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { abgleich } from '#lib/db/abgleich.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { thema } from '#lib/thema.svelte.ts';
	import { reiseFarbe } from '#lib/farben.ts';
	import { reisenSortiert, naechte, km, fotosVon, reiseEnde } from '#lib/auswertung.ts';
	import { zeitraum, jahr, zahl } from '#lib/datum.ts';

	let fehler = $state('');
	let laedt = $state(!daten.gast);
	const token = $derived(page.params.token ?? '');

	onMount(async () => {
		ui.gastStart = `#/teilen/${token}`;
		ui.auswahl = null;
		if (daten.gast) return ui.zeigeAlles();
		try {
			const g = await abgleich.freigabeLesen(token);
			if (!g) fehler = 'Dieser Link ist nicht (mehr) gültig.';
			else {
				daten.gastLaden({ name: g.name, reisen: g.reisen, eintraege: g.eintraege, plaetze: g.plaetze, fotos: g.fotos });
				setTimeout(() => ui.zeigeAlles(), 300);
			}
		} catch (e) {
			fehler = (e as Error).message;
		} finally {
			laedt = false;
		}
	});

	const reisen = $derived(reisenSortiert());
	const titelbild = (id: string) => daten.foto(daten.reise(id)?.titelbild)?.vorschau ?? fotosVon(id)[0]?.vorschau;
</script>

<div class="seite">
	<div class="banner"><Eye size={18} /> Geteilte Reisen – nur zum Ansehen</div>
	{#if laedt}
		<p class="leer">Lädt …</p>
	{:else if fehler}
		<p class="leer">{fehler}</p>
	{:else if !reisen.length}
		<p class="leer">Hier ist (noch) nichts freigegeben.</p>
	{:else}
		<div class="reisen">
			{#each reisen as r (r.id)}
				{@const bild = titelbild(r.id)}
				<a class="reise" class:ohne-bild={!bild} href="#/reise/{r.id}" style="--rf:{reiseFarbe(r.farbe, thema.dunkel)}">
					{#if bild}<img class="cover" alt="" src={bild} loading="lazy" />{/if}
					<span class="r-txt">
						<span class="jahr zahl">{jahr(r.start)}</span>
						<span class="r-titel">{r.titel}</span>
						<span class="zeit">{zeitraum(r.start, r.ende ?? reiseEnde(r))}</span>
						<span class="zahlen zahl">
							<span><b>{naechte(r.id)}</b> Nächte</span>
							{#if km(r.id)}<span><b>{zahl(km(r.id))}</b> km</span>{/if}
							{#if fotosVon(r.id).length}<span><b>{fotosVon(r.id).length}</b> Fotos</span>{/if}
						</span>
					</span>
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.seite {
		padding: 4px 18px 0;
	}
	.banner {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 14px;
		padding: 10px 12px;
		border-radius: var(--radius);
		background: var(--signal);
		color: var(--signal-text);
		font-size: 14px;
		font-weight: 600;
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
	.ohne-bild {
		height: 150px;
		background: linear-gradient(135deg, color-mix(in srgb, var(--rf) 85%, #000), color-mix(in srgb, var(--rf) 55%, #000));
	}
	.ohne-bild .r-txt {
		background: none;
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
	}
</style>
