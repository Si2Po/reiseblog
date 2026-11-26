<!--
  Fotoalbum: alle Fotos, nach Reisen gruppiert (neueste zuerst), dann „Ohne Reise“.
  Tippen öffnet die Großansicht – von dort „Zur Reise“ bzw. „Auf der Karte“.
  Fotos lassen sich hier auch ohne Reise hinzufügen: passt das Aufnahmedatum zu einer Reise,
  landen sie dort, sonst stehen sie für sich (Karte und Album).
  Filter „Ohne Ort“ + „Auswählen“: mehrere Fotos gemeinsam auf der Karte platzieren (Fadenkreuz).
-->
<script lang="ts">
	import { pfeile } from '#lib/ui/pfeile.ts';
	import { kontext } from '#lib/ui/kontext.ts';
	import { fotoAktionen } from '#lib/fotos/aktionen.ts';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import Plus from 'phosphor-svelte/lib/Plus';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import MapPinPlus from 'phosphor-svelte/lib/MapPinPlus';
	import Trash from 'phosphor-svelte/lib/Trash';
	import Tray from 'phosphor-svelte/lib/Tray';
	import Reiter from '#lib/ui/Reiter.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { reisenSortiert, reiseEnde } from '#lib/auswertung.ts';
	import { zeitraum, monatJahr, zahl, wort } from '#lib/datum.ts';
	import { fotosWaehlen } from '#lib/fotos/import.ts';
	import type { Foto } from '#lib/db/typen.ts';

	const nachZeit = (a: Foto, b: Foto) => a.aufgenommen.localeCompare(b.aufgenommen);
	const fotoText = (n: number) => `${zahl(n)} ${wort(n, 'Foto', 'Fotos')}`;

	/** nur Fotos ohne Ort zeigen */
	let nurOhneOrt = $state(false);
	/** Auswahl-Modus: Tippen wählt aus statt zu öffnen */
	let auswaehlen = $state(false);
	let gewaehlt = $state<Set<string>>(new Set());

	const ohneOrt = $derived(daten.fotos.filter((f) => !f.ort).length);
	$effect(() => {
		// Filter verschwindet, wenn alle Fotos einen Ort haben
		if (!ohneOrt) nurOhneOrt = false;
	});

	interface Gruppe {
		id: string;
		titel: string;
		unter: string;
		reise?: string;
		fotos: Foto[];
	}
	const gruppen = $derived.by((): Gruppe[] => {
		const alle = nurOhneOrt ? daten.fotos.filter((f) => !f.ort) : daten.fotos;
		const liste: Gruppe[] = [];
		for (const r of reisenSortiert()) {
			const fotos = alle.filter((f) => f.reise === r.id).sort(nachZeit);
			if (fotos.length) liste.push({ id: r.id, titel: r.titel, unter: zeitraum(r.start, r.ende ?? reiseEnde(r)), reise: r.id, fotos });
		}
		// Fotos ohne (noch vorhandene) Reise: nach Monat, neueste zuerst
		const ohne = alle.filter((f) => !daten.reise(f.reise)).sort(nachZeit).reverse();
		const monate = new Map<string, Foto[]>();
		for (const f of ohne) monate.set(f.aufgenommen.slice(0, 7), [...(monate.get(f.aufgenommen.slice(0, 7)) ?? []), f]);
		for (const [m, fotos] of monate) liste.push({ id: 'ohne-' + m, titel: monatJahr(m + '-01'), unter: 'Ohne Reise', fotos: fotos.reverse() });
		return liste;
	});

	onMount(() => {
		ui.auswahl = null;
		ui.markiert = null;
		// Fotos auf der Karte nur hier automatisch an; beim Verlassen gilt wieder die vorige Einstellung
		const vorher = ui.fotosAn;
		ui.fotosAn = true;
		if (daten.geladen) ui.zeigeAlles();
		return () => {
			ui.fotosAn = vorher;
		};
	});

	function getippt(g: Gruppe, f: Foto, i: number) {
		if (!auswaehlen) {
			ui.gross = { ids: g.fotos.map((x) => x.id), i };
			return;
		}
		const neu = new Set(gewaehlt);
		if (neu.has(f.id)) neu.delete(f.id);
		else neu.add(f.id);
		gewaehlt = neu;
	}
	function auswahlEnde() {
		auswaehlen = false;
		gewaehlt = new Set();
	}

	/** Gewählte Fotos gemeinsam an den Ort unter dem Fadenkreuz setzen */
	async function platzieren() {
		const fotos = [...gewaehlt].map((id) => daten.foto(id)).filter((f): f is Foto => !!f);
		const start = fotos.find((f) => f.ort)?.ort;
		const o = await ui.ortWaehlen(start);
		if (!o) return;
		for (const f of fotos) await daten.speichern('fotos', { ...f, ort: { lat: o.lat, lng: o.lng } });
		auswahlEnde();
		ui.fotosAn = true;
		ui.zeigeOrt(o, 13);
		ui.zeige(`${fotoText(fotos.length)} auf der Karte platziert`);
	}
	async function loeschen() {
		const ids = [...gewaehlt];
		const zurueck = await daten.loeschenAlle(ids.map((id) => ['fotos', id]));
		auswahlEnde();
		ui.zeige(`${fotoText(ids.length)} gelöscht`, zurueck);
	}
</script>

<Reiter />

<div class="seite" {@attach pfeile('.raster button', 'raster')}>
	<div class="kopf">
		{#if auswaehlen}
			<span class="ueber zahl">{gewaehlt.size ? `${fotoText(gewaehlt.size)} ausgewählt` : 'Fotos antippen'}</span>
			<button class="knopf zweit" onclick={auswahlEnde}>Fertig</button>
		{:else}
			<span class="ueber zahl">{fotoText(daten.fotos.length)}</span>
			<span class="knoepfe">
				{#if daten.fotos.length}<button class="knopf zweit" onclick={() => (auswaehlen = true)}>Auswählen</button>{/if}
				{#if daten.fotos.length}<button class="knopf zweit" onclick={() => fotosWaehlen()} aria-label="Fotos hinzufügen"><Plus size={18} weight="bold" /></button>{/if}
			</span>
		{/if}
	</div>

	{#if ohneOrt}
		<div class="filter" role="radiogroup" aria-label="Filter">
			<button role="radio" aria-checked={!nurOhneOrt} class:an={!nurOhneOrt} onclick={() => (nurOhneOrt = false)}>Alle</button>
			<button role="radio" aria-checked={nurOhneOrt} class:an={nurOhneOrt} onclick={() => (nurOhneOrt = true)}>Ohne Ort ({ohneOrt})</button>
		</div>
		{#if nurOhneOrt && !auswaehlen}
			<p class="hilfe">Diese Fotos stehen noch nicht auf der Karte. Mit „Auswählen“ mehrere antippen und gemeinsam platzieren.</p>
		{/if}
	{/if}

	{#if !daten.fotos.length}
		<p class="leer">
			Noch keine Fotos. Füge sie bei einer Reise hinzu oder hier: Fotos aus einer Reisezeit landen automatisch bei der Reise, alle anderen stehen für
			sich auf der Karte. Damit der Ort mitkommt, in der Fotoauswahl unter „Optionen“ den Standort einschalten.
		</p>
		<button class="knopf breit-leer" onclick={() => fotosWaehlen()}><Plus size={18} weight="bold" /> Fotos hinzufügen</button>
	{/if}

	{#each gruppen as g (g.id)}
		<section>
			{#if g.reise && !auswaehlen}
				<a class="gkopf" href="#/reise/{g.reise}">
					<span><b>{g.titel}</b><small>{g.unter} · {fotoText(g.fotos.length)}</small></span>
					<CaretRight size={16} />
				</a>
			{:else}
				<div class="gkopf">
					<span><b>{g.titel}</b><small>{g.unter} · {fotoText(g.fotos.length)}</small></span>
				</div>
			{/if}
			<div class="raster">
				{#each g.fotos as f, i (f.id)}
					<button
						class:gewaehlt={gewaehlt.has(f.id)}
						onclick={() => getippt(g, f, i)}
						{@attach kontext(() => (auswaehlen ? { punkte: [] } : fotoAktionen(f, () => getippt(g, f, i))))}
						aria-label={auswaehlen ? 'Foto auswählen' : 'Foto ansehen'}
						aria-pressed={auswaehlen ? gewaehlt.has(f.id) : undefined}
					>
						<img alt="" src={f.vorschau} loading="lazy" />
						{#if auswaehlen}<span class="haken" class:an={gewaehlt.has(f.id)}>{#if gewaehlt.has(f.id)}<CheckCircle size={24} weight="fill" />{/if}</span>{/if}
					</button>
				{/each}
			</div>
		</section>
	{/each}

	{#if auswaehlen && gewaehlt.size}
		<div class="leiste" transition:fly={{ y: 40, duration: 180 }}>
			<button class="knopf" onclick={platzieren}><MapPinPlus size={18} /> Platzieren</button>
			<button
				class="knopf zweit"
				onclick={() => {
					const fotos = [...gewaehlt];
					auswahlEnde();
					ui.dialog = { art: 'zuordnen', fotos };
				}}><Tray size={18} /> Zuordnen</button
			>
			<button class="knopf zweit weg" onclick={loeschen} aria-label="Ausgewählte Fotos löschen"><Trash size={18} /></button>
		</div>
	{/if}
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
	.knoepfe {
		display: flex;
		gap: 6px;
	}
	.kopf .knopf {
		height: 38px;
		padding: 0 14px;
		font-size: 15px;
	}
	.breit-leer {
		width: 100%;
	}
	.filter {
		display: flex;
		gap: 6px;
		margin: 4px 0 6px;
	}
	.filter button {
		height: 34px;
		padding: 0 14px;
		border: 1px solid var(--linie);
		border-radius: 17px;
		background: none;
		color: var(--text-2);
		font-size: 14px;
		font-weight: 560;
	}
	.filter button.an {
		border-color: var(--text);
		background: var(--text);
		color: var(--flaeche);
	}
	.hilfe {
		margin: 6px 0 0;
		color: var(--text-2);
		font-size: 14px;
		line-height: 1.4;
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
		position: relative;
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
		transition: transform 0.15s var(--sanft);
	}
	.raster button.gewaehlt img {
		transform: scale(0.9);
	}
	.haken {
		position: absolute;
		right: 6px;
		bottom: 6px;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border: 2px solid #fff;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.2);
		color: var(--signal);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}
	.haken.an {
		border: 0;
		background: #fff;
	}
	/* Aktionen für die Auswahl: bleibt unten im Blick */
	.leiste {
		position: sticky;
		bottom: calc(12px + env(safe-area-inset-bottom));
		display: flex;
		gap: 8px;
		margin-top: 16px;
		padding: 8px;
		border-radius: var(--radius-gross);
		background: var(--flaeche);
		box-shadow: var(--schatten-dialog);
	}
	.leiste .knopf:first-child {
		flex: 1;
	}
	.leiste .weg {
		width: 48px;
		padding: 0;
		color: var(--gefahr);
	}
</style>
