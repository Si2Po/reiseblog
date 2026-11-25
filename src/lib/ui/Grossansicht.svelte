<!--
  Foto-Großansicht: Wischen links/rechts (iPhone), Pfeiltasten (PC), nach unten wischen schließt.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import X from 'phosphor-svelte/lib/X';
	import MapPin from 'phosphor-svelte/lib/MapPin';
	import Image from 'phosphor-svelte/lib/Image';
	import Trash from 'phosphor-svelte/lib/Trash';
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import { ui } from '#lib/ui.svelte.ts';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { vollbild } from '#lib/fotos/bild.ts';
	import { tagLang } from '#lib/datum.ts';

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

	async function alsTitelbild() {
		if (!reise || !foto) return;
		await daten.speichern('reisen', { ...reise, titelbild: foto.id });
		ui.zeige(`Titelbild von „${reise.titel}“`);
	}

	// Wischen
	let x0 = 0,
		y0 = 0,
		dx = $state(0),
		dy = $state(0),
		zieht = $state(false);
	function start(e: TouchEvent) {
		if (e.touches.length !== 1) return;
		x0 = e.touches[0].clientX;
		y0 = e.touches[0].clientY;
		zieht = true;
	}
	function bewegen(e: TouchEvent) {
		if (!zieht) return;
		dx = e.touches[0].clientX - x0;
		dy = Math.max(0, e.touches[0].clientY - y0);
	}
	function ende() {
		if (!zieht) return;
		zieht = false;
		if (dy > 110 && Math.abs(dy) > Math.abs(dx)) zu();
		else if (dx < -60) blaettern(1);
		else if (dx > 60) blaettern(-1);
		dx = dy = 0;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (!g) return;
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
			<b>{eintrag?.titel ?? reise?.titel ?? 'Foto'}</b>
			<span class="zahl">{tagLang(foto.aufgenommen.slice(0, 10))}{g.ids.length > 1 ? ` · ${g.i + 1} von ${g.ids.length}` : ''}</span>
			<div class="knoepfe">
				{#if foto.ort}
					<button
						onclick={() => {
							const o = foto.ort!;
							zu();
							ui.fotosAn = true;
							ui.zeigeOrt(o, 14);
						}}><MapPin size={14} weight="fill" /> Auf der Karte</button
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
	.unterschrift b {
		font-size: 20px;
		font-weight: 650;
	}
	.unterschrift span {
		color: #aaa;
		font-size: 14px;
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
