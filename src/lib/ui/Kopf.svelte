<!-- Kopfzeile für Unterseiten: Zurück links, optionale Knöpfe rechts. Bleibt beim Scrollen oben. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';

	let { zurueck, rechts }: { zurueck?: string; rechts?: Snippet } = $props();
	const ziel = $derived(zurueck ?? '#/');

	function weg(e: MouseEvent) {
		// Wenn es eine Seite davor in der App gibt, dorthin zurück (behält Scrollposition)
		if (history.length > 1 && document.referrer === '' && history.state) {
			e.preventDefault();
			history.back();
		}
	}
</script>

<div class="kopf">
	<a class="zurueck" href={ziel} onclick={weg}><CaretLeft size={18} weight="bold" /> Zurück</a>
	{#if rechts}<div class="rechts">{@render rechts()}</div>{/if}
</div>

<style>
	.kopf {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 10px 4px 8px;
		background: var(--flaeche);
	}
	.zurueck {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 44px;
		padding: 0 10px 0 6px;
		color: var(--text);
		font-weight: 600;
		text-decoration: none;
	}
	.rechts {
		display: flex;
		gap: 6px;
	}
	.rechts :global(button) {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 38px;
		padding: 0 12px;
		border: 0;
		border-radius: 19px;
		background: var(--flaeche-2);
		font-size: 15px;
		font-weight: 560;
	}
</style>
