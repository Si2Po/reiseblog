<!--
  Aktionen-Menü (ui.aktionen): am iPhone als Liste von unten, am PC als kleines Menü an der
  Mausposition (Rechtsklick bzw. „…“). Ein Tipp auf einen Punkt schließt das Menü und führt ihn aus.
-->
<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { ui, type Aktion } from '#lib/ui.svelte.ts';

	const a = $derived(ui.aktionen);
	/** am PC (oder mit Mausposition): schwebendes Menü statt Liste von unten */
	const schwebend = $derived(!!a && a.x !== undefined && ui.breit);
	let menue: HTMLElement | undefined = $state();
	let pos = $state({ x: 0, y: 0 });

	// im Fenster halten
	$effect(() => {
		if (!a || !schwebend || !menue) return;
		const b = menue.offsetWidth,
			h = menue.offsetHeight;
		pos = { x: Math.min(a.x!, innerWidth - b - 8), y: Math.min(a.y!, innerHeight - h - 8) };
	});

	const zu = () => (ui.aktionen = null);
	async function los(p: Aktion) {
		zu();
		// Fehler einer Aktion dürfen das Menü nicht „hängen“ lassen
		try {
			await p.los();
		} catch (e) {
			console.error('Aktion', p.text, e);
			ui.zeige(`„${p.text}“ ging nicht: ${(e as Error).message}`);
		}
	}
	function zumBody(el: HTMLElement) {
		document.body.append(el);
		return () => el.remove();
	}
</script>

<svelte:window onkeydown={(e) => a && e.key === 'Escape' && zu()} />

{#if a}
	<div class="portal" {@attach zumBody}>
		<div class="dimmer" class:hell={schwebend} onclick={zu} oncontextmenu={(e) => (e.preventDefault(), zu())} role="presentation" transition:fade={{ duration: 150 }}></div>
		{#if schwebend}
			<div class="schwebend" bind:this={menue} role="menu" style:left="{pos.x}px" style:top="{pos.y}px" transition:fade={{ duration: 100 }}>
				{#each a.punkte as p (p.text)}
					<button role="menuitem" class:gefahr={p.gefahr} onclick={() => los(p)}>
						{#if p.icon}<p.icon size={17} />{/if}
						{p.text}
					</button>
				{/each}
			</div>
		{:else}
			<div class="unten" role="menu" aria-label={a.titel ?? 'Aktionen'} transition:fly={{ y: 300, duration: 260, easing: cubicOut }}>
				<div class="gruppe">
					{#if a.titel}<p class="titel">{a.titel}</p>{/if}
					{#each a.punkte as p (p.text)}
						<button role="menuitem" class:gefahr={p.gefahr} onclick={() => los(p)}>
							{#if p.icon}<p.icon size={20} />{/if}
							{p.text}
						</button>
					{/each}
				</div>
				<button class="abbrechen" onclick={zu}>Abbrechen</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.portal {
		display: contents;
	}
	.dimmer {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: rgba(0, 0, 0, 0.35);
	}
	.dimmer.hell {
		background: transparent;
	}
	.unten {
		position: fixed;
		left: 8px;
		right: 8px;
		bottom: calc(8px + env(safe-area-inset-bottom));
		z-index: 81;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.gruppe,
	.abbrechen {
		border-radius: var(--radius-gross);
		background: var(--flaeche);
		box-shadow: var(--schatten-dialog);
		overflow: hidden;
	}
	.titel {
		margin: 0;
		padding: 12px 16px 10px;
		border-bottom: 1px solid var(--linie);
		color: var(--text-2);
		font-size: 13px;
		font-weight: 600;
		text-align: center;
	}
	.gruppe button {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 54px;
		padding: 0 18px;
		border: 0;
		border-bottom: 1px solid var(--linie);
		background: none;
		color: var(--text);
		font-size: 17px;
		text-align: left;
	}
	.gruppe button:last-child {
		border-bottom: 0;
	}
	.abbrechen {
		min-height: 54px;
		border: 0;
		color: var(--text);
		font-size: 17px;
		font-weight: 650;
	}
	.schwebend {
		position: fixed;
		z-index: 81;
		min-width: 200px;
		padding: 5px;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		box-shadow: var(--schatten-dialog);
	}
	.schwebend button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 36px;
		padding: 0 10px;
		border: 0;
		border-radius: calc(var(--radius) - 3px);
		background: none;
		color: var(--text);
		font-size: 14px;
		text-align: left;
	}
	.schwebend button:hover {
		background: var(--flaeche-2);
	}
	.gefahr {
		color: var(--gefahr) !important;
	}
</style>
