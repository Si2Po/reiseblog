<!--
  Zeile mit Wischgesten (iPhone), wie in der Mail-App:
  - ein Stück nach links wischen legt Knöpfe frei (`links`, z. B. Löschen · Details) – erst ein Tipp löst aus
  - ganz nach links durchziehen löst den äußersten Knopf (den letzten in `links`) direkt aus;
    kurz vorher füllt er die ganze Breite, damit man sieht, was gleich passiert
  - nach rechts wischen löst `rechts` direkt aus (z. B. „Hinzufügen“-Menü)
  - Rechtsklick (PC) ruft `onmenue` mit der Mausposition auf
  Die Knöpfe wachsen beim Wischen mit (Symbol und Text blenden ein). Es ist immer nur eine Zeile
  offen; ein Tipp auf die offene Zeile schließt sie wieder.
-->
<script lang="ts" module>
	/** die gerade offene Zeile (nur eine zur Zeit) */
	let offeneZeile = $state<symbol | null>(null);
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Aktion } from '#lib/ui.svelte.ts';

	let {
		links = [],
		rechts,
		onmenue,
		children
	}: {
		links?: Aktion[];
		rechts?: Aktion;
		onmenue?: (x: number, y: number) => void;
		children: Snippet;
	} = $props();

	const ich = Symbol();
	const KNOPF = 80;
	/** Breite der freigelegten Knöpfe (eingerastet) */
	const breite = $derived(links.length * KNOPF);
	let zeilenBreite = $state(0);
	/** ab hier löst Durchziehen den äußersten Knopf aus */
	const vollAb = $derived(Math.max(breite + 60, zeilenBreite * 0.6));

	let dx = $state(0);
	let zieht = $state(false);
	let x0 = 0,
		y0 = 0,
		basis = 0;
	let richtung: 'x' | 'y' | null = null;
	/** nach einem Wisch den folgenden Klick schlucken */
	let geradeGewischt = 0;

	const offen = $derived(offeneZeile === ich && dx < 0);
	const voll = $derived(links.length > 0 && -dx >= vollAb);
	/** 0…1: wie weit die Knöpfe schon zu sehen sind (für das Einblenden) */
	const anteil = $derived(breite ? Math.min(1, -dx / breite) : 0);
	$effect(() => {
		// eine andere Zeile wurde geöffnet → diese schließen
		if (offeneZeile !== ich && !zieht) dx = 0;
	});

	function start(e: TouchEvent) {
		if (e.touches.length !== 1) return;
		x0 = e.touches[0].clientX;
		y0 = e.touches[0].clientY;
		basis = offeneZeile === ich ? dx : 0;
		richtung = null;
	}
	function bewegen(e: TouchEvent) {
		const mx = e.touches[0].clientX - x0,
			my = e.touches[0].clientY - y0;
		if (!richtung) {
			if (Math.abs(mx) < 7 && Math.abs(my) < 7) return;
			richtung = Math.abs(mx) > Math.abs(my) * 1.2 && (mx < 0 ? breite > 0 || basis < 0 : !!rechts || basis < 0) ? 'x' : 'y';
			if (richtung === 'x') {
				zieht = true;
				offeneZeile = ich;
			}
		}
		if (richtung !== 'x') return;
		// Seite nicht scrollen, Sheet nicht ziehen
		if (e.cancelable) e.preventDefault();
		e.stopPropagation();
		let x = basis + mx;
		const minX = -zeilenBreite,
			maxX = rechts ? 110 : 0;
		if (x < minX) x = minX + (x - minX) * 0.25;
		if (x > maxX) x = maxX + (x - maxX) * 0.25;
		dx = x;
	}
	function ende() {
		if (richtung !== 'x') return;
		zieht = false;
		geradeGewischt = Date.now();
		if (dx > 70 && rechts) {
			schliessen();
			rechts.los();
		} else if (voll) {
			schliessen();
			links[links.length - 1].los();
		} else if (dx < -Math.min(60, breite / 2)) dx = -breite;
		else schliessen();
	}
	function schliessen() {
		dx = 0;
		if (offeneZeile === ich) offeneZeile = null;
	}

	// Touch-Bewegung braucht passive: false, damit preventDefault wirkt
	function beobachten(el: HTMLElement) {
		el.addEventListener('touchmove', bewegen, { passive: false });
		return () => el.removeEventListener('touchmove', bewegen);
	}
</script>

<div
	class="wz"
	role="group"
	bind:clientWidth={zeilenBreite}
	{@attach beobachten}
	ontouchstart={start}
	ontouchend={ende}
	ontouchcancel={ende}
	oncontextmenu={(e) => {
		if (!onmenue) return;
		e.preventDefault();
		// Kontextmenü-Taste bzw. Umschalt+F10: keine Mausposition → am Element öffnen
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const ohneMaus = e.clientX === 0 && e.clientY === 0;
		onmenue(ohneMaus ? r.left + 48 : e.clientX, ohneMaus ? r.top + 24 : e.clientY);
	}}
>
	{#if dx > 0 && rechts}
		<div class="hinten links-seite" style:opacity={Math.min(1, dx / 70)}>
			{#if rechts.icon}<rechts.icon size={20} />{/if}
			<span>{rechts.text}</span>
		</div>
	{/if}
	{#if dx < 0}
		<div class="hinten rechts-seite" class:zieht class:voll style:width="{-dx}px">
			{#each links as a, i (a.text)}
				<button
					class:gefahr={a.gefahr}
					class:aussen={i === links.length - 1}
					onclick={() => {
						schliessen();
						a.los();
					}}
				>
					<span class="inhalt" style:opacity={anteil} style:transform="scale({0.6 + 0.4 * anteil})">
						{#if a.icon}<a.icon size={20} />{/if}
						<span>{a.text}</span>
					</span>
				</button>
			{/each}
		</div>
	{/if}
	<div
		class="vorne"
		class:zieht
		style:transform={dx ? `translateX(${dx}px)` : undefined}
		onclickcapture={(e) => {
			// Klick direkt nach dem Wischen oder auf die offene Zeile: nur schließen
			if (Date.now() - geradeGewischt < 350 || offen) {
				e.stopPropagation();
				e.preventDefault();
				if (offen) schliessen();
			}
		}}
		role="presentation"
	>
		{@render children()}
	</div>
</div>

<style>
	.wz {
		position: relative;
		overflow: hidden;
		border-radius: inherit;
		touch-action: pan-y;
	}
	.vorne {
		position: relative;
		transition: transform 0.28s var(--sanft);
	}
	.vorne.zieht {
		transition: none;
	}
	.hinten {
		position: absolute;
		top: 0;
		bottom: 0;
		display: flex;
	}
	.links-seite {
		left: 0;
		align-items: center;
		gap: 8px;
		padding-left: 16px;
		color: var(--rf, var(--text));
		font-size: 14px;
		font-weight: 650;
	}
	/* Knöpfe hinter der Zeile: abgerundete Kacheln, die mit dem Finger mitwachsen */
	.rechts-seite {
		right: 0;
		gap: 6px;
		padding: 6px 6px 6px 0;
		transition: width 0.28s var(--sanft);
	}
	.rechts-seite.zieht {
		transition: none;
	}
	.rechts-seite button {
		flex: 1 1 0;
		min-width: 0;
		overflow: hidden;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: var(--radius);
		background: var(--rf, var(--text));
		color: var(--flaeche);
		font-size: 12px;
		font-weight: 650;
		transition:
			flex-grow 0.22s var(--sanft),
			opacity 0.22s;
	}
	.rechts-seite button.gefahr {
		background: var(--gefahr);
		color: #fff;
	}
	/* Durchziehen: der äußerste Knopf übernimmt die ganze Breite */
	.rechts-seite.voll button:not(.aussen) {
		flex-grow: 0.0001;
		opacity: 0;
	}
	.rechts-seite.voll button.aussen {
		flex-grow: 1;
	}
	.inhalt {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
	}
</style>
