<!--
  Dialog: am iPhone von unten hereinfahrend, am PC mittig.
  Inhalt scrollt, Fußzeile (Knöpfe) bleibt stehen.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import X from 'phosphor-svelte/lib/X';
	import { ui } from '#lib/ui.svelte.ts';

	let {
		titel,
		onschliessen,
		children,
		fuss,
		versteckt = false
	}: {
		titel: string;
		onschliessen: () => void;
		children: Snippet;
		fuss?: Snippet;
		/** während „Ort auf der Karte wählen“ ausgeblendet, aber nicht verworfen */
		versteckt?: boolean;
	} = $props();

	function zumBody(el: HTMLElement) {
		document.body.append(el);
		return () => el.remove();
	}
</script>

<!-- Esc: erst eine offene Foto-Großansicht darüber schließen, nicht den Dialog darunter -->
<svelte:window onkeydown={(e) => e.key === 'Escape' && !versteckt && !ui.gross && onschliessen()} />

<!-- An den <body> gehängt: sonst würde ein verschobenes Sheet (transform) „fixed“ verfälschen -->
<div class="portal" {@attach zumBody}>
	<div class="dimmer" class:versteckt onclick={onschliessen} role="presentation" transition:fade={{ duration: 180 }}></div>
	<div
		class="dialog"
		class:breit={ui.breit}
		class:versteckt
		role="dialog"
		aria-modal="true"
		aria-label={titel}
		transition:fly={ui.breit ? { y: 24, duration: 220, easing: cubicOut } : { y: 400, duration: 320, easing: cubicOut }}
	>
		<header>
			<h2>{titel}</h2>
			<button class="rund" onclick={onschliessen} aria-label="Schließen"><X size={18} /></button>
		</header>
		<div class="inhalt">{@render children()}</div>
		{#if fuss}<footer>{@render fuss()}</footer>{/if}
	</div>
</div>

<style>
	.portal {
		display: contents;
	}
	.dimmer {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: var(--dimmer);
	}
	.dialog {
		position: fixed;
		z-index: 41;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		max-height: calc(100dvh - env(safe-area-inset-top) - 24px);
		border-radius: var(--radius-gross) var(--radius-gross) 0 0;
		background: var(--flaeche);
		box-shadow: var(--schatten-dialog);
	}
	.dialog.breit {
		left: 50%;
		right: auto;
		top: 50%;
		bottom: auto;
		width: min(560px, calc(100vw - 48px));
		max-height: min(820px, calc(100vh - 48px));
		transform: translate(-50%, -50%);
		border-radius: var(--radius-gross);
	}
	.versteckt {
		visibility: hidden;
		pointer-events: none;
	}
	header {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 16px 8px 20px;
	}
	h2 {
		font-size: 24px;
	}
	.inhalt {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 4px 20px 20px;
	}
	footer {
		flex: none;
		display: flex;
		gap: 10px;
		padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
		border-top: 1px solid var(--linie);
	}
	footer :global(.knopf:not(.fuss-links)) {
		flex: 1;
	}
	.breit footer {
		padding-bottom: 14px;
	}
</style>
