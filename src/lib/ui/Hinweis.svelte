<!-- Kurzer Hinweis (iPhone: oben, PC: unten), optional mit Knopf („Rückgängig“ oder z. B. „Zuordnen“). -->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { ui } from '#lib/ui.svelte.ts';
</script>

{#if ui.hinweis}
	{#key ui.hinweis.nr}
		<div class="hinweis" class:breit={ui.breit} role="status" transition:fly={{ y: ui.breit ? 16 : -16, duration: 200 }}>
			<span>{ui.hinweis.text}</span>
			{#if ui.hinweis.rueckgaengig}
				<button
					onclick={() => {
						const r = ui.hinweis?.rueckgaengig;
						ui.hinweis = null;
						r?.();
					}}>{ui.hinweis.knopf ?? 'Rückgängig'}</button
				>
			{/if}
		</div>
	{/key}
{/if}

<style>
	.hinweis {
		position: fixed;
		z-index: 60;
		top: calc(env(safe-area-inset-top) + 10px);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 14px;
		max-width: calc(100vw - 32px);
		min-height: 44px;
		padding: 8px 8px 8px 16px;
		border-radius: 22px;
		background: var(--text);
		color: var(--flaeche);
		font-size: 15px;
		font-weight: 550;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
	}
	.hinweis.breit {
		top: auto;
		bottom: 24px;
		left: calc(var(--leiste-breite) + (100vw - var(--leiste-breite)) / 2);
	}
	span {
		padding-right: 8px;
	}
	button {
		height: 32px;
		padding: 0 14px;
		border: 0;
		border-radius: 16px;
		background: var(--signal);
		color: var(--signal-text);
		font-weight: 650;
		font-size: 14px;
	}
</style>
