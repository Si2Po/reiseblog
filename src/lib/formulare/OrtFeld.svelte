<!--
  Ort wählen: aktueller Standort (GPS), Suche mit Vorschlägen, oder auf der Karte zeigen.
-->
<script lang="ts">
	import Crosshair from 'phosphor-svelte/lib/Crosshair';
	import MapPin from 'phosphor-svelte/lib/MapPin';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import MapTrifold from 'phosphor-svelte/lib/MapTrifold';
	import X from 'phosphor-svelte/lib/X';
	import type { Ort } from '#lib/db/typen.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { standort, koordText } from '#lib/geo.ts';
	import { ortSuchen, ortsname, type Vorschlag } from '#lib/geo/dienste.ts';

	let { ort = $bindable<Ort | undefined>(), name = 'Ort', onwahl }: { ort?: Ort; name?: string; onwahl?: (o: Ort) => void } = $props();

	let suche = $state('');
	let vorschlaege = $state<Vorschlag[]>([]);
	let sucht = $state(false);
	let gps = $state(false);
	let suchModus = $state(false);
	let timer: ReturnType<typeof setTimeout>;
	let abbruch: AbortController | null = null;

	function setzen(o: Ort) {
		ort = o;
		suchModus = false;
		suche = '';
		vorschlaege = [];
		onwahl?.(o);
	}

	async function mitName(lat: number, lng: number) {
		setzen({ lat, lng });
		const n = await ortsname(lat, lng);
		if (ort && ort.lat === lat && ort.lng === lng) setzen({ lat, lng, ...n });
	}

	async function hier() {
		gps = true;
		try {
			const p = await standort();
			ui.ich = { lat: p.coords.latitude, lng: p.coords.longitude, genau: p.coords.accuracy };
			await mitName(p.coords.latitude, p.coords.longitude);
		} catch (e) {
			ui.zeige((e as Error).message);
		} finally {
			gps = false;
		}
	}

	async function aufKarte() {
		const o = await ui.ortWaehlen(ort ?? ui.ich ?? undefined);
		if (o) await mitName(o.lat, o.lng);
	}

	function tippen() {
		clearTimeout(timer);
		abbruch?.abort();
		const q = suche.trim();
		if (q.length < 2) return (vorschlaege = []);
		timer = setTimeout(async () => {
			sucht = true;
			abbruch = new AbortController();
			try {
				vorschlaege = await ortSuchen(q, ort ?? ui.ich ?? undefined, abbruch.signal);
			} catch (e) {
				if ((e as Error).name !== 'AbortError') ui.zeige((e as Error).message);
			} finally {
				sucht = false;
			}
		}, 280);
	}
</script>

<div class="feld">
	<span class="name">{name}</span>
	{#if ort && !suchModus}
		<div class="gewaehlt">
			<MapPin size={20} weight="fill" />
			<span class="txt">
				<b>{ort.name ?? 'Gewählter Punkt'}{ort.land ? `, ${ort.land}` : ''}</b>
				<span class="zahl">{koordText(ort)}</span>
			</span>
			<button type="button" class="rund" onclick={() => (suchModus = true)} aria-label="Ort ändern"><X size={16} /></button>
		</div>
	{:else}
		<div class="knoepfe">
			<button type="button" class="knopf zweit" onclick={hier} disabled={gps}>
				<Crosshair size={18} />
				{gps ? 'Standort …' : 'Hier'}
			</button>
			<button type="button" class="knopf zweit" onclick={aufKarte}><MapTrifold size={18} /> Auf Karte</button>
		</div>
		<label class="suche">
			<MagnifyingGlass size={18} />
			<input type="search" placeholder="Ort suchen" bind:value={suche} oninput={tippen} enterkeyhint="search" autocomplete="off" />
		</label>
		{#if vorschlaege.length || sucht}
			<ul class="vorschlaege">
				{#if sucht && !vorschlaege.length}<li class="lade">Suche …</li>{/if}
				{#each vorschlaege as v, i (i)}
					<li>
						<button type="button" onclick={() => setzen({ lat: v.lat, lng: v.lng, name: v.name, land: v.land })}>
							<b>{v.name}</b>
							<span>{v.zusatz}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		{#if ort}<button type="button" class="knopf still" onclick={() => (suchModus = false)}>Doch nicht ändern</button>{/if}
	{/if}
</div>

<style>
	.gewaehlt {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 10px 10px 12px;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}
	.txt {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.txt span {
		font-size: 13px;
		color: var(--text-2);
	}
	.knoepfe {
		display: flex;
		gap: 8px;
	}
	.knoepfe .knopf {
		flex: 1;
		min-height: 44px;
	}
	.suche {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 46px;
		padding: 0 12px;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		color: var(--text-2);
	}
	.suche input {
		flex: 1;
		min-width: 0;
		border: 0 !important;
		height: 44px !important;
		padding: 0 !important;
		background: none !important;
	}
	.vorschlaege {
		margin: 0;
		padding: 4px;
		list-style: none;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
	}
	.vorschlaege button {
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 8px 10px;
		border: 0;
		border-radius: 4px;
		background: none;
		text-align: left;
	}
	.vorschlaege button:hover,
	.vorschlaege button:active {
		background: var(--flaeche-2);
	}
	.vorschlaege span,
	.lade {
		font-size: 13px;
		color: var(--text-2);
	}
	.lade {
		padding: 8px 10px;
	}
</style>
