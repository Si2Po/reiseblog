<!-- Suche nach Ort, Titel, Notiz – eingrenzbar nach Zeitraum und Art. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import X from 'phosphor-svelte/lib/X';
	import Tent from 'phosphor-svelte/lib/Tent';
	import Van from 'phosphor-svelte/lib/Van';
	import Footprints from 'phosphor-svelte/lib/Footprints';
	import MapTrifold from 'phosphor-svelte/lib/MapTrifold';
	import Reiter from '#lib/ui/Reiter.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { thema } from '#lib/thema.svelte.ts';
	import { reiseFarbe } from '#lib/farben.ts';
	import { eintragFolge } from '#lib/auswertung.ts';
	import { kurz } from '#lib/datum.ts';
	import type { LngLat, Typ } from '#lib/db/typen.ts';
	import { TYP_NAME } from '#lib/db/typen.ts';

	let text = $state('');
	let von = $state('');
	let bis = $state('');
	let typen = $state<Typ[]>([]);
	let feld: HTMLInputElement | undefined = $state();

	onMount(() => {
		ui.auswahl = null;
		if (ui.breit) feld?.focus();
	});

	const jahre = $derived([...new Set(daten.reisen.map((r) => r.start.slice(0, 4)))].sort().reverse());
	const jahrAktiv = (j: string) => von === `${j}-01-01` && bis === `${j}-12-31`;
	function jahrWaehlen(j: string) {
		if (jahrAktiv(j)) von = bis = '';
		else {
			von = `${j}-01-01`;
			bis = `${j}-12-31`;
		}
	}

	const klein = (s: string | undefined) => (s ?? '').toLocaleLowerCase('de');
	const aktiv = $derived(!!(text.trim() || von || bis || typen.length));
	const treffer = $derived.by(() => {
		if (!aktiv) return [];
		const woerter = klein(text).split(/\s+/).filter(Boolean);
		return daten.eintraege
			.filter((e) => {
				if (von && e.datum < von) return false;
				if (bis && e.datum > bis) return false;
				if (typen.length && !typen.includes(e.typ)) return false;
				if (!woerter.length) return true;
				const p = daten.platz(e.platz);
				const r = daten.reise(e.reise);
				const heu = [e.titel, e.text, e.ort?.name, e.ort?.land, p?.name, p?.notiz, r?.titel, ...(e.notizen ?? []).map((n) => n.text)].map(klein).join(' ');
				return woerter.every((w) => heu.includes(w));
			})
			.sort((a, b) => -eintragFolge(a, b));
	});

	function aufKarte() {
		const k: LngLat[] = treffer.flatMap((e) => (e.route?.length ? e.route : e.ort ? [[e.ort.lng, e.ort.lat] as LngLat] : []));
		if (k.length) ui.karte?.zeigeBereich(k, ui.rand(), 12);
		if (!ui.breit) ui.hoehe = 'halb';
	}

	const SYMBOL = { stay: Tent, drive: Van, outing: Footprints };
	const umschalten = (t: Typ) => (typen = typen.includes(t) ? typen.filter((x) => x !== t) : [...typen, t]);
</script>

<Reiter />

<div class="seite">
	<label class="suchfeld">
		<MagnifyingGlass size={20} />
		<input bind:this={feld} type="search" placeholder="Ort, Platz oder Notiz" bind:value={text} enterkeyhint="search" />
		{#if text}<button class="leeren" onclick={() => (text = '')} aria-label="Leeren"><X size={16} /></button>{/if}
	</label>

	<div class="chips rand">
		{#each jahre as j (j)}
			<button class:an={jahrAktiv(j)} onclick={() => jahrWaehlen(j)}>{j}</button>
		{/each}
		{#each Object.entries(TYP_NAME) as [t, name] (t)}
			<button class:an={typen.includes(t as Typ)} onclick={() => umschalten(t as Typ)}>{name}</button>
		{/each}
	</div>

	<div class="zeitraum">
		<label><span>Von</span><input type="date" bind:value={von} /></label>
		<label><span>Bis</span><input type="date" bind:value={bis} /></label>
	</div>

	{#if aktiv}
		<div class="kopfzeile">
			<span class="ueber">{treffer.length} {treffer.length === 1 ? 'Treffer' : 'Treffer'}</span>
			{#if treffer.length}<button class="aufkarte" onclick={aufKarte}><MapTrifold size={16} /> Auf der Karte</button>{/if}
		</div>
		<ul class="treffer">
			{#each treffer as e (e.id)}
				{@const Sym = SYMBOL[e.typ]}
				{@const r = daten.reise(e.reise)}
				<li>
					<a href="#/reise/{e.reise}" onclick={() => (ui.markiert = e.id)}>
						<span class="sym" style:color={reiseFarbe(r?.farbe ?? 0, thema.dunkel)}><Sym size={18} /></span>
						<span class="t-txt">
							<b>{e.titel}</b>
							<span class="zahl">{e.ort?.name ? `${e.ort.name} · ` : ''}{kurz(e.datum)} · {r?.titel ?? ''}</span>
						</span>
					</a>
				</li>
			{:else}
				<li class="leer">Nichts gefunden.</li>
			{/each}
		</ul>
	{:else}
		<p class="leer">Suche nach Orten, Plätzen und Notizen – oder grenze nach Jahr, Zeitraum und Art ein.</p>
	{/if}
</div>

<style>
	.seite {
		padding: 0 18px;
	}
	.suchfeld {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 48px;
		margin: 2px 0 10px;
		padding: 0 6px 0 14px;
		border-radius: var(--radius);
		background: var(--flaeche-2);
		color: var(--text-2);
	}
	.suchfeld input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: 0;
		background: none;
		color: var(--text);
	}
	.leeren {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border: 0;
		border-radius: 50%;
		background: var(--linie);
		color: var(--text);
	}
	.rand {
		margin: 0 -18px 10px;
		padding: 0 18px;
	}
	.zeitraum {
		display: flex;
		gap: 10px;
		margin-bottom: 8px;
	}
	.zeitraum label {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-2);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.zeitraum input {
		width: 100%;
		height: 44px;
		padding: 0 10px;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		text-transform: none;
		letter-spacing: 0;
		min-width: 0;
	}
	.kopfzeile {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 12px 0 4px;
	}
	.aufkarte {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 34px;
		padding: 0 12px;
		border: 0;
		border-radius: 17px;
		background: var(--flaeche-2);
		font-size: 14px;
		font-weight: 550;
	}
	.treffer {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.treffer a {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 58px;
		padding: 8px 0;
		border-bottom: 1px solid var(--linie);
		color: inherit;
		text-decoration: none;
	}
	.sym {
		flex: none;
		display: grid;
		place-items: center;
		width: 32px;
	}
	.t-txt {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.t-txt span {
		font-size: 13px;
		color: var(--text-2);
	}
</style>
