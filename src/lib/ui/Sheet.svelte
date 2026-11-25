<!--
  Bottom-Sheet mit drei Höhen (klein, halb, voll), wie in Apple Karten.
  Ziehen am Kopf geht immer; im Inhalt nur, wenn er ganz oben steht.
  Inhalt scrollt nur in voller Höhe, sonst bewegt jede Wischbewegung das Sheet.
-->
<script lang="ts" module>
	export type Hoehe = 'klein' | 'halb' | 'voll';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	let {
		hoehe = $bindable<Hoehe>('halb'),
		sichtbar = $bindable(0),
		klein = 132,
		kopf,
		children,
		versteckt = false
	}: {
		hoehe?: Hoehe;
		sichtbar?: number;
		klein?: number;
		kopf?: Snippet;
		children: Snippet;
		/** ganz nach unten weg (z. B. beim „Ort wählen“), Inhalt bleibt erhalten */
		versteckt?: boolean;
	} = $props();

	let fensterHoehe = $state(800);
	let obenFrei = $state(0);
	let inhalt: HTMLDivElement | undefined = $state();
	let ziehen = $state<number | null>(null); // aktuelle sichtbare Höhe beim Ziehen

	const hoehen = $derived({
		klein,
		halb: Math.round(fensterHoehe * 0.52),
		voll: fensterHoehe - obenFrei - 10
	});
	const ziel = $derived(versteckt ? -40 : (ziehen ?? hoehen[hoehe]));

	$effect(() => {
		sichtbar = ziel;
	});

	onMount(() => {
		const messen = () => {
			fensterHoehe = window.innerHeight;
			const probe = getComputedStyle(document.documentElement).getPropertyValue('--sicher-oben');
			obenFrei = Math.max(48, parseFloat(probe) || 0) + 8;
		};
		messen();
		window.addEventListener('resize', messen);
		return () => window.removeEventListener('resize', messen);
	});

	// --- Ziehen mit Touch (iOS) und Maus (Desktop) ---
	let startY = 0;
	let startH = 0;
	let letzteY = 0;
	let letzteZeit = 0;
	let tempo = 0;
	let modus: 'offen' | 'ziehen' | 'scrollen' = 'offen';
	let imInhalt = false;

	function beginn(y: number, ziel: EventTarget | null) {
		startY = letzteY = y;
		startH = hoehen[hoehe];
		letzteZeit = performance.now();
		tempo = 0;
		modus = 'offen';
		imInhalt = !!inhalt && ziel instanceof Node && inhalt.contains(ziel);
	}

	function bewegen(y: number): boolean {
		const dy = y - startY;
		if (modus === 'offen') {
			if (Math.abs(dy) < 6) return false;
			if (imInhalt && hoehe === 'voll') {
				const oben = (inhalt?.scrollTop ?? 0) <= 0;
				modus = oben && dy > 0 ? 'ziehen' : 'scrollen';
			} else modus = 'ziehen';
		}
		if (modus !== 'ziehen') return false;
		const jetzt = performance.now();
		tempo = (letzteY - y) / Math.max(1, jetzt - letzteZeit); // px/ms, positiv = nach oben
		letzteY = y;
		letzteZeit = jetzt;
		let h = startH - dy;
		// Gummiband über die Grenzen hinaus
		if (h > hoehen.voll) h = hoehen.voll + (h - hoehen.voll) * 0.25;
		if (h < hoehen.klein) h = hoehen.klein - (hoehen.klein - h) * 0.25;
		ziehen = h;
		return true;
	}

	function ende() {
		if (modus === 'ziehen' && ziehen !== null) {
			const reihe: Hoehe[] = ['klein', 'halb', 'voll'];
			const h = ziehen;
			if (Math.abs(tempo) > 0.45) {
				// schneller Wisch: eine Stufe in Wischrichtung
				const i = reihe.indexOf(hoehe) + (tempo > 0 ? 1 : -1);
				hoehe = reihe[Math.max(0, Math.min(2, i))];
			} else {
				// langsam losgelassen: nächstgelegene Stufe
				hoehe = reihe.reduce((a, b) => (Math.abs(hoehen[b] - h) < Math.abs(hoehen[a] - h) ? b : a));
			}
		}
		ziehen = null;
		modus = 'offen';
	}

	function touchstart(e: TouchEvent) {
		beginn(e.touches[0].clientY, e.target);
	}
	function touchmove(e: TouchEvent) {
		if (bewegen(e.touches[0].clientY) && e.cancelable) e.preventDefault();
	}
	function mausrunter(e: PointerEvent) {
		if (e.pointerType !== 'mouse' || e.button !== 0) return;
		beginn(e.clientY, e.target);
		const bew = (ev: PointerEvent) => bewegen(ev.clientY);
		const hoch = () => {
			ende();
			window.removeEventListener('pointermove', bew);
			window.removeEventListener('pointerup', hoch);
		};
		window.addEventListener('pointermove', bew);
		window.addEventListener('pointerup', hoch);
	}

	function sheetAktion(el: HTMLElement) {
		el.addEventListener('touchmove', touchmove, { passive: false });
		return () => el.removeEventListener('touchmove', touchmove);
	}

	function griffTippen() {
		hoehe = hoehe === 'klein' ? 'halb' : hoehe === 'halb' ? 'voll' : 'halb';
	}
</script>

<section
	class="sheet"
	class:zieht={ziehen !== null}
	style:height="{hoehen.voll + 40}px"
	style:transform="translateY({hoehen.voll + 40 - ziel}px)"
	ontouchstart={touchstart}
	ontouchend={ende}
	ontouchcancel={ende}
	onpointerdown={mausrunter}
	{@attach sheetAktion}
	aria-label="Inhalt"
>
	<button class="griff" onclick={griffTippen} aria-label="Größe ändern"><span></span></button>
	{#if kopf}<div class="kopf">{@render kopf()}</div>{/if}
	<div class="inhalt" class:scrollt={hoehe === 'voll' && ziehen === null} bind:this={inhalt}>
		{@render children()}
	</div>
</section>

<style>
	.sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		background: var(--flaeche);
		border-radius: var(--radius-gross) var(--radius-gross) 0 0;
		box-shadow: var(--schatten);
		transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
		will-change: transform;
		user-select: none;
		-webkit-user-select: none;
	}
	.sheet.zieht {
		transition: none;
	}
	.griff {
		flex: none;
		display: grid;
		place-items: center;
		height: 22px;
		width: 100%;
		border: 0;
		background: none;
		padding: 0;
		cursor: grab;
	}
	.griff span {
		width: 38px;
		height: 5px;
		border-radius: 3px;
		background: var(--linie);
	}
	.kopf {
		flex: none;
	}
	.inhalt {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		padding-bottom: calc(40px + env(safe-area-inset-bottom));
		user-select: text;
		-webkit-user-select: text;
	}
	.inhalt.scrollt {
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}
</style>
