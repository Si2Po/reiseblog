<!-- Bewertung eingeben: 1–5 Sterne, nochmal auf denselben Stern = keine Bewertung. -->
<script lang="ts">
	import Star from 'phosphor-svelte/lib/Star';

	let { wert = $bindable<number | undefined>() }: { wert?: number } = $props();
</script>

<div class="sterne" role="radiogroup" aria-label="Bewertung">
	{#each [1, 2, 3, 4, 5] as i (i)}
		<button
			type="button"
			role="radio"
			aria-checked={wert === i}
			aria-label="{i} {i === 1 ? 'Stern' : 'Sterne'}"
			class:an={(wert ?? 0) >= i}
			onclick={() => (wert = wert === i ? undefined : i)}
		>
			<Star size={30} weight={(wert ?? 0) >= i ? 'fill' : 'regular'} />
		</button>
	{/each}
</div>

<style>
	.sterne {
		display: flex;
		gap: 2px;
	}
	button {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		background: none;
		color: color-mix(in srgb, var(--text-2) 55%, transparent);
		transition: transform 0.15s;
	}
	button.an {
		color: var(--stern);
	}
	button:active {
		transform: scale(0.88);
	}
</style>
