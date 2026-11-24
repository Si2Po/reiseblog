<!-- Bewertung als Sterne (auch halbe), nur Anzeige. -->
<script lang="ts">
	import Star from 'phosphor-svelte/lib/Star';
	import StarHalf from 'phosphor-svelte/lib/StarHalf';

	let { wert, groesse = 14 }: { wert: number; groesse?: number } = $props();
	const gerundet = $derived(Math.round(wert * 2) / 2);
</script>

<span class="sterne" aria-label="{gerundet.toLocaleString('de-DE')} von 5 Sternen">
	{#each [1, 2, 3, 4, 5] as i (i)}
		{#if gerundet >= i}
			<Star weight="fill" size={groesse} />
		{:else if gerundet >= i - 0.5}
			<StarHalf weight="fill" size={groesse} />
		{:else}
			<Star weight="regular" size={groesse} class="aus" />
		{/if}
	{/each}
</span>

<style>
	.sterne {
		display: inline-flex;
		gap: 1px;
		color: var(--stern);
		vertical-align: -2px;
	}
	.sterne :global(.aus) {
		color: color-mix(in srgb, var(--text-2) 45%, transparent);
	}
</style>
