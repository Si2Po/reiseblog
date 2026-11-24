<!--
  „Hier eintragen“: holt sofort den Standort, schlägt die laufende Reise vor
  und fragt nur noch nach der Art. Ein Tipp → passendes Formular, schon ausgefüllt.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Tent from 'phosphor-svelte/lib/Tent';
	import Footprints from 'phosphor-svelte/lib/Footprints';
	import Ticket from 'phosphor-svelte/lib/Ticket';
	import Van from 'phosphor-svelte/lib/Van';
	import Camera from 'phosphor-svelte/lib/Camera';
	import Crosshair from 'phosphor-svelte/lib/Crosshair';
	import Plus from 'phosphor-svelte/lib/Plus';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { thema } from '#lib/thema.svelte.ts';
	import { reiseFarbe } from '#lib/farben.ts';
	import { laufendeReise, reisenSortiert, plaetzeInDerNaehe } from '#lib/auswertung.ts';
	import { standort, koordText } from '#lib/geo.ts';
	import { ortsname } from '#lib/geo/dienste.ts';
	import { heute } from '#lib/datum.ts';
	import { fotosWaehlen } from '#lib/fotos/import.ts';
	import type { Ort, Typ } from '#lib/db/typen.ts';

	let ort = $state<Ort | undefined>();
	let genau = $state(0);
	let fehler = $state('');
	let sucht = $state(true);

	const reisen = reisenSortiert();
	let reise = $state(laufendeReise()?.id ?? reisen[0]?.id ?? '');
	const r = $derived(daten.reise(reise));
	const bekannt = $derived(ort ? plaetzeInDerNaehe(ort.lat, ort.lng)[0] : undefined);

	onMount(async () => {
		try {
			const p = await standort();
			const { latitude: lat, longitude: lng, accuracy } = p.coords;
			ui.ich = { lat, lng, genau: accuracy };
			ort = { lat, lng };
			genau = accuracy;
			ui.zeigeOrt(ort, 13);
			const n = await ortsname(lat, lng);
			if (ort?.lat === lat) ort = { lat, lng, ...n };
		} catch (e) {
			fehler = (e as Error).message;
		} finally {
			sucht = false;
		}
	});

	function weiter(typ: Typ) {
		ui.dialog = { art: 'eintrag', vorlage: { reise, typ, datum: heute(), ort, platz: typ === 'stay' ? bekannt?.id : undefined } };
	}
</script>

<Dialog titel="Hier eintragen" onschliessen={() => (ui.dialog = null)}>
	<div class="standort" class:fehler={!!fehler}>
		<span class="ortsym" class:sucht><Crosshair size={20} /></span>
		<span class="txt">
			{#if sucht}
				<b>Standort wird ermittelt …</b>
				<span>Einen Moment</span>
			{:else if ort}
				<b>{ort.name ?? 'Aktueller Standort'}{ort.land ? `, ${ort.land}` : ''}</b>
				<span class="zahl">{koordText(ort)}{genau ? ` · auf ${Math.round(genau)} m genau` : ''}</span>
			{:else}
				<b>Kein Standort</b>
				<span>{fehler} Den Ort kannst du im nächsten Schritt auch suchen oder auf der Karte zeigen.</span>
			{/if}
		</span>
	</div>
	{#if bekannt}
		<p class="bekannt">Du warst schon mal hier: <b>{bekannt.name}</b></p>
	{/if}

	{#if reisen.length}
		<label class="reisewahl">
			<span class="punkt" style:background={reiseFarbe(r?.farbe ?? 0, thema.dunkel)}></span>
			<span>Zur Reise</span>
			<select bind:value={reise}>
				{#each reisen as x (x.id)}<option value={x.id}>{x.titel} ({x.start.slice(0, 4)})</option>{/each}
			</select>
		</label>

		<div class="wahl">
			<button onclick={() => weiter('stay')}><Tent size={30} weight="duotone" /> Übernachtung</button>
			<button onclick={() => weiter('outing')}><Footprints size={30} weight="duotone" /> Ausflug</button>
			<button onclick={() => weiter('event')}><Ticket size={30} weight="duotone" /> Event</button>
		</div>
		<div class="unten">
			<button class="knopf still" onclick={() => weiter('drive')}><Van size={20} /> Fahrt</button>
			<button
				class="knopf still"
				onclick={() => {
					ui.dialog = null;
					fotosWaehlen({ reise });
				}}><Camera size={20} /> Nur Fotos</button
			>
		</div>
	{:else}
		<p class="hinweis">Leg zuerst eine Reise an – danach landet alles, was du hier einträgst, automatisch darin.</p>
		<button class="knopf breit" onclick={() => (ui.dialog = { art: 'reise' })}><Plus size={18} weight="bold" /> Neue Reise ab heute</button>
	{/if}
</Dialog>

<style>
	.standort {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}
	.ortsym {
		flex: none;
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		background: var(--signal);
		color: var(--signal-text);
	}
	.ortsym.sucht {
		animation: puls 1.1s ease-in-out infinite;
	}
	@keyframes puls {
		50% {
			transform: scale(0.85);
			opacity: 0.6;
		}
	}
	.txt {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.txt span {
		color: var(--text-2);
		font-size: 13px;
	}
	.bekannt {
		margin: 10px 2px 0;
		font-size: 14px;
		color: var(--text-2);
	}
	.bekannt b {
		color: var(--text);
	}
	.reisewahl {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 48px;
		margin: 8px 0 10px;
		color: var(--text-2);
		font-size: 15px;
	}
	.punkt {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	.reisewahl select {
		flex: 1;
		min-width: 0;
		height: 40px;
		padding: 0 8px;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		font-weight: 600;
	}
	.wahl {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}
	.wahl button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 18px 2px 14px;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		font-weight: 620;
		font-size: 14px;
	}
	.wahl button :global(svg) {
		color: var(--stern);
	}
	.wahl button:active {
		background: var(--flaeche-2);
	}
	.unten {
		display: flex;
		gap: 8px;
		margin-top: 6px;
	}
	.unten .knopf {
		flex: 1;
	}
	.hinweis {
		margin: 16px 0 12px;
		color: var(--text-2);
		line-height: 1.45;
	}
	.breit {
		width: 100%;
	}
</style>
