<!-- Meldet neue App-Versionen (Service Worker). Geladen wird erst auf Tippen, damit nichts mitten im Eintragen verloren geht. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';
	import { ui } from '#lib/ui.svelte.ts';

	let neu = $state(false);
	let laden: (() => Promise<void>) | null = null;

	onMount(async () => {
		// Lokal (Entwicklung) gibt es keinen Service Worker
		if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || !('serviceWorker' in navigator)) return;
		const { useRegisterSW } = await import('virtual:pwa-register/svelte');
		const sw = useRegisterSW({
			onRegisteredSW(_url, reg) {
				// stündlich und beim Zurückkehren in die App nach Updates schauen
				if (!reg) return;
				setInterval(() => reg.update(), 60 * 60 * 1000);
				document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update());
			}
		});
		laden = sw.updateServiceWorker;
		sw.needRefresh.subscribe((v) => (neu = v));
	});
</script>

{#if neu && !ui.dialog}
	<button class="neu" class:breit={ui.breit} onclick={() => laden?.()} transition:fly={{ y: -20, duration: 220 }}>
		<ArrowClockwise size={18} weight="bold" /> Neue Version – tippen zum Laden
	</button>
{/if}

<style>
	.neu {
		position: fixed;
		z-index: 55;
		top: calc(env(safe-area-inset-top) + 64px);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 8px;
		height: 42px;
		padding: 0 16px;
		border: 0;
		border-radius: 21px;
		background: var(--signal);
		color: var(--signal-text);
		font-size: 15px;
		font-weight: 650;
		white-space: nowrap;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
	}
	.neu.breit {
		top: 18px;
		left: calc(var(--leiste-breite) + (100vw - var(--leiste-breite)) / 2);
	}
</style>
