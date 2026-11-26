<!--
  Foto-Großansicht: Wischen links/rechts (iPhone), Pfeiltasten (PC), nach unten wischen schließt.
  Titel antippen = Foto zuordnen, Datum antippen = Aufnahmezeit ändern (siehe datumSpeichern).
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import X from 'phosphor-svelte/lib/X';
	import MapPin from 'phosphor-svelte/lib/MapPin';
	import Image from 'phosphor-svelte/lib/Image';
	import Trash from 'phosphor-svelte/lib/Trash';
	import Van from 'phosphor-svelte/lib/Van';
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
	import { reiseAm } from '#lib/fotos/import.ts';
	import { fotoAufKarte } from '#lib/fotos/aktionen.ts';
	import { page } from '$app/state';
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import { ui, zurReise } from '#lib/ui.svelte.ts';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { vollbild } from '#lib/fotos/bild.ts';
	import { tagMitJahr } from '#lib/datum.ts';

	const g = $derived(ui.gross);
	const foto = $derived(g ? daten.foto(g.ids[g.i]) : undefined);
	const reise = $derived(daten.reise(foto?.reise));
	const eintrag = $derived(daten.eintrag(foto?.eintrag));
	let url = $state('');

	$effect(() => {
		const f = foto;
		if (!f) return;
		url = f.vorschau;
		vollbild(f).then((u) => {
			if (foto?.id === f.id) url = u;
		});
	});

	function blaettern(r: number) {
		if (!g) return;
		const n = g.ids.length;
		ui.gross = { ids: g.ids, i: (g.i + r + n) % n };
	}
	const zu = () => (ui.gross = null);

	/** Foto löschen (mit Rückgängig); die Großansicht springt zum nächsten Foto */
	async function loeschen() {
		if (!g || !foto) return;
		const id = foto.id;
		const zurueck = await daten.loeschen('fotos', id);
		if (reise?.titelbild === id) await daten.speichern('reisen', { ...reise, titelbild: undefined });
		const ids = g.ids.filter((x) => x !== id);
		ui.gross = ids.length ? { ids, i: Math.min(g.i, ids.length - 1) } : null;
		ui.zeige('Foto gelöscht', zurueck);
	}

	// Aufnahmezeit ändern (z. B. falsche Kamera-Uhr, Foto ohne Datum)
	let datumOffen = $state(false);
	let neueZeit = $state('');
	$effect(() => {
		// beim Blättern zu
		void foto?.id;
		datumOffen = false;
	});
	function datumAendern() {
		if (!foto) return;
		neueZeit = foto.aufgenommen.slice(0, 16);
		datumOffen = true;
	}
	/**
	 * Mit Eintrag bleibt das Foto dort. Ohne Eintrag bestimmt das Datum den Tag in der Zeitleiste;
	 * fällt es in eine andere Reise, wandert das Foto dorthin.
	 */
	async function datumSpeichern() {
		if (!foto || !neueZeit) return;
		const aufgenommen = neueZeit.length === 16 ? neueZeit + ':00' : neueZeit;
		const andere = foto.eintrag ? undefined : reiseAm(aufgenommen.slice(0, 10));
		const neu = await daten.speichern('fotos', { ...foto, aufgenommen, reise: andere ?? foto.reise });
		datumOffen = false;
		const r = daten.reise(neu.reise);
		ui.zeige(andere && andere !== foto.reise ? `Datum geändert · jetzt bei „${r?.titel}“` : 'Datum geändert');
	}

	async function alsTitelbild() {
		if (!reise || !foto) return;
		await daten.speichern('reisen', { ...reise, titelbild: foto.id });
		ui.zeige(`Titelbild von „${reise.titel}“`);
	}

	// Wischen: Die Richtung wird nach den ersten Pixeln festgelegt – seitwärts blättert nur,
	// nach unten schließt nur (sonst wackelt das Bild beim Blättern, als wolle es zugehen).
	let x0 = 0,
		y0 = 0,
		richtung: 'x' | 'y' | null = null,
		dx = $state(0),
		dy = $state(0),
		zieht = $state(false);
	function start(e: TouchEvent) {
		// im Datumsfeld nicht wischen
		if (e.touches.length !== 1 || (e.target as HTMLElement).closest('.datum')) return;
		x0 = e.touches[0].clientX;
		y0 = e.touches[0].clientY;
		richtung = null;
		zieht = true;
	}
	function bewegen(e: TouchEvent) {
		if (!zieht) return;
		const mx = e.touches[0].clientX - x0,
			my = e.touches[0].clientY - y0;
		if (!richtung) {
			if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
			richtung = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
		}
		if (richtung === 'x') dx = mx;
		else dy = Math.max(0, my);
	}
	function ende() {
		if (!zieht) return;
		zieht = false;
		if (richtung === 'y' && dy > 110) zu();
		else if (richtung === 'x' && dx < -60) blaettern(1);
		else if (richtung === 'x' && dx > 60) blaettern(-1);
		dx = dy = 0;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (!g) return;
		// beim Tippen im Datumsfeld bleiben die Tasten dort; Esc schließt nur das Feld
		if ((e.target as HTMLElement).closest?.('.datum')) {
			if (e.key === 'Escape') datumOffen = false;
			return;
		}
		if (e.key === 'ArrowRight') blaettern(1);
		else if (e.key === 'ArrowLeft') blaettern(-1);
		else if (e.key === 'Escape') zu();
	}}
/>

{#if g && foto}
	<div
		class="gross"
		role="dialog"
		aria-label="Foto"
		tabindex="-1"
		transition:fade={{ duration: 200 }}
		ontouchstart={start}
		ontouchmove={bewegen}
		ontouchend={ende}
		style:background-color="rgba(8, 8, 8, {1 - Math.min(dy / 400, 0.6)})"
	>
		<button class="rund zu" onclick={zu} aria-label="Schließen"><X size={20} /></button>
		<img
			alt=""
			src={url}
			class:zieht
			style:transform="translate({dx}px, {dy}px) scale({1 - Math.min(dy / 1600, 0.15)})"
		/>
		{#if g.ids.length > 1}
			<button class="blatt links" onclick={() => blaettern(-1)} aria-label="Vorheriges Foto"><CaretLeft size={26} /></button>
			<button class="blatt rechts" onclick={() => blaettern(1)} aria-label="Nächstes Foto"><CaretRight size={26} /></button>
		{/if}
		<div class="unterschrift">
			<!-- Titel antippen = Foto einer Reise / einem Eintrag zuordnen -->
			<button
				class="titel"
				onclick={() => {
					const id = foto.id;
					zu();
					ui.dialog = { art: 'zuordnen', fotos: [id] };
				}}
				aria-label="Foto zuordnen"
				>{eintrag?.titel ?? reise?.titel ?? foto.ort?.name ?? 'Foto'} <PencilSimple size={15} /></button
			>
			<!-- Datum antippen = Aufnahmezeit ändern -->
			<span class="zeile"
				><button class="zeit zahl" onclick={datumAendern} aria-label="Aufnahmezeit ändern"
					>{tagMitJahr(foto.aufgenommen.slice(0, 10))} <PencilSimple size={12} /></button
				><span class="zahl">{g.ids.length > 1 ? ` · ${g.i + 1} von ${g.ids.length}` : ''}</span></span
			>
			{#if datumOffen}
				<form
					class="datum"
					onsubmit={(e) => {
						e.preventDefault();
						datumSpeichern();
					}}
				>
					<!-- svelte-ignore a11y_autofocus -->
					<input type="datetime-local" bind:value={neueZeit} aria-label="Aufnahmezeit" autofocus />
					<button type="submit" class="ok">Speichern</button>
					<button type="button" onclick={() => (datumOffen = false)} aria-label="Abbrechen"><X size={16} /></button>
				</form>
			{/if}
			<div class="knoepfe">
				{#if foto.ort}
					<button
						onclick={() => {
							const o = foto.ort!;
							zu();
							fotoAufKarte(o);
						}}><MapPin size={14} weight="fill" /> Auf der Karte</button
					>
				{/if}
				{#if reise && page.params.id !== reise.id}
					<button
						onclick={() => {
							// erst merken: nach zu() gibt es kein Foto (und damit keine Reise) mehr
							const [r, e] = [reise.id, eintrag?.id];
							zu();
							zurReise(r, e);
						}}><Van size={14} weight="fill" /> Zur Reise</button
					>
				{/if}
				{#if reise && reise.titelbild !== foto.id}
					<button onclick={alsTitelbild}><Image size={14} weight="fill" /> Als Titelbild</button>
				{/if}
				<button class="weg" onclick={loeschen} aria-label="Foto löschen"><Trash size={16} /></button>
			</div>
		</div>
	</div>
{/if}

<style>
	.gross {
		position: fixed;
		inset: 0;
		z-index: 70;
		display: grid;
		place-items: center;
		background: #080808;
		touch-action: none;
	}
	img {
		max-width: 100%;
		max-height: 80vh;
		object-fit: contain;
		transition: transform 0.25s var(--sanft);
		user-select: none;
		-webkit-user-drag: none;
	}
	img.zieht {
		transition: none;
	}
	.zu {
		position: absolute;
		z-index: 2;
		top: calc(env(safe-area-inset-top) + 12px);
		right: 14px;
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
	}
	.blatt {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border: 0;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
		opacity: 0;
		transition: opacity 0.2s;
	}
	.blatt.links {
		left: 16px;
	}
	.blatt.rechts {
		right: 16px;
	}
	@media (hover: hover) {
		.gross:hover .blatt {
			opacity: 1;
		}
	}
	.unterschrift {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 16px 20px calc(20px + env(safe-area-inset-bottom));
		color: #eee;
	}
	.titel {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		align-self: flex-start;
		margin: 0 0 0 -4px;
		padding: 2px 4px;
		border: 0;
		border-radius: 6px;
		background: none;
		color: #eee;
		font-size: 20px;
		font-weight: 650;
		text-align: left;
	}
	.titel :global(svg) {
		flex: none;
		color: #888;
	}
	.zeit {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		min-height: 32px;
		margin: -6px 0 -6px -4px;
		padding: 0 4px;
		border: 0;
		border-radius: 6px;
		background: none;
		color: #aaa;
		font-size: 14px;
		text-decoration: underline dotted rgba(255, 255, 255, 0.35);
		text-underline-offset: 3px;
	}
	@media (hover: hover) {
		.zeit:hover {
			color: #fff;
		}
	}
	.unterschrift span {
		color: #aaa;
		font-size: 14px;
	}
	.datum {
		display: flex;
		gap: 8px;
		margin-top: 10px;
	}
	.datum input {
		flex: 1;
		min-width: 0;
		height: 40px;
		padding: 0 10px;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: var(--radius);
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
		font-size: 16px;
		color-scheme: dark;
	}
	.datum button {
		height: 40px;
		padding: 0 14px;
		border: 0;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
		font-size: 14px;
	}
	.datum .ok {
		background: #fff;
		color: #111;
		font-weight: 600;
	}
	.knoepfe {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 10px;
	}
	.knoepfe button {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 36px;
		padding: 0 14px;
		border: 0;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
		font-size: 14px;
	}
	.knoepfe .weg {
		margin-left: auto;
		width: 36px;
		padding: 0;
		justify-content: center;
		color: #ff8a73;
	}
</style>
