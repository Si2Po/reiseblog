<!-- Ausgaben eines Eintrags: je Zeile Art, Betrag, Währung. Leere Beträge werden beim Speichern weggelassen. -->
<script lang="ts">
	import X from 'phosphor-svelte/lib/X';
	import Plus from 'phosphor-svelte/lib/Plus';
	import { KOSTEN_ART, type Kosten, type KostenArt, type Typ } from '#lib/db/typen.ts';
	import { WAEHRUNGEN } from '#lib/kosten.svelte.ts';

	let { kosten = $bindable([]), waehrung, typ }: { kosten: Kosten[]; waehrung: string; typ: Typ } = $props();

	const VORSCHLAG: Record<Typ, KostenArt> = { drive: 'tanken', outing: 'eintritt', stay: 'einkauf' };

	function neu() {
		kosten = [...kosten, { id: crypto.randomUUID(), art: kosten.length && typ === 'drive' ? 'maut' : VORSCHLAG[typ], betrag: null as unknown as number, waehrung: kosten.at(-1)?.waehrung ?? waehrung }];
		// Fokus ins neue Betragsfeld
		setTimeout(() => document.querySelector<HTMLInputElement>('.kosten-zeile:last-of-type input')?.focus(), 30);
	}
</script>

<div class="feld">
	<span class="name">{typ === 'stay' ? 'Weitere Ausgaben' : 'Ausgaben'}</span>
	{#each kosten as k, i (k.id)}
		<div class="kosten-zeile">
			<select bind:value={k.art} aria-label="Art der Ausgabe">
				{#each Object.entries(KOSTEN_ART) as [a, name] (a)}<option value={a}>{name}</option>{/each}
			</select>
			<input type="number" inputmode="decimal" min="0" step="0.01" bind:value={k.betrag} placeholder="Betrag" aria-label="Betrag" />
			<select class="w" bind:value={k.waehrung} aria-label="Währung">
				{#each WAEHRUNGEN as w (w)}<option value={w}>{w}</option>{/each}
			</select>
			<button type="button" class="rund" onclick={() => (kosten = kosten.filter((_, j) => j !== i))} aria-label="Ausgabe entfernen"><X size={14} /></button>
		</div>
	{/each}
	<button type="button" class="dazu" onclick={neu}><Plus size={16} /> {typ === 'drive' ? 'Tanken, Maut, Fähre …' : typ === 'outing' ? 'Eintritt, Essen …' : 'Ausgabe'}</button>
</div>

<style>
	.kosten-zeile {
		display: grid;
		grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) 76px 32px;
		gap: 6px;
		align-items: center;
	}
	.kosten-zeile select {
		padding: 0 6px 0 10px;
	}
	.kosten-zeile .w {
		padding: 0 4px 0 8px;
	}
	.dazu {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		align-self: flex-start;
		height: 40px;
		padding: 0 14px;
		border: 1.5px dashed var(--linie);
		border-radius: 20px;
		background: none;
		color: var(--text);
		font-weight: 600;
	}
</style>
