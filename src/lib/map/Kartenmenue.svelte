<!-- Ein kleiner Knopf an der Karte, der die Kartenoptionen aufklappt. -->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import StackSimple from 'phosphor-svelte/lib/StackSimple';
	import Images from 'phosphor-svelte/lib/Images';
	import NavigationArrow from 'phosphor-svelte/lib/NavigationArrow';
	import ArrowsOut from 'phosphor-svelte/lib/ArrowsOut';
	import Check from 'phosphor-svelte/lib/Check';
	import { ui } from '#lib/ui.svelte.ts';
	import { standort } from '#lib/geo.ts';

	let offen = $state(false);
	let suchtStandort = $state(false);

	async function hierBinIch() {
		offen = false;
		suchtStandort = true;
		try {
			const p = await standort();
			ui.ich = { lat: p.coords.latitude, lng: p.coords.longitude, genau: p.coords.accuracy };
			ui.zeigeOrt(ui.ich, 13);
		} catch (e) {
			ui.zeige((e as Error).message);
		} finally {
			suchtStandort = false;
		}
	}
</script>

<svelte:window onclick={() => (offen = false)} />

<div class="menue" class:breit={ui.breit}>
	<button
		class="haupt"
		class:an={offen}
		onclick={(e) => {
			e.stopPropagation();
			offen = !offen;
		}}
		aria-expanded={offen}
		aria-label="Kartenoptionen"
	>
		{#if suchtStandort}<span class="dreht"><NavigationArrow size={20} /></span>{:else}<StackSimple size={21} />{/if}
		{#if ui.fotosAn}<span class="punkt"></span>{/if}
	</button>
	{#if offen}
		<div class="liste" role="menu" tabindex="-1" transition:fly={{ y: -8, duration: 180, easing: cubicOut }} onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
			<button role="menuitemcheckbox" aria-checked={ui.fotosAn} onclick={() => ((ui.fotosAn = !ui.fotosAn), (offen = false))}>
				<Images size={20} /> Fotos auf der Karte
				{#if ui.fotosAn}<Check size={18} weight="bold" class="haken" />{/if}
			</button>
			<button role="menuitem" onclick={hierBinIch}><NavigationArrow size={20} /> Mein Standort</button>
			<button role="menuitem" onclick={() => ((offen = false), ui.zeigeAlles())}><ArrowsOut size={20} /> Alle Reisen zeigen</button>
		</div>
	{/if}
</div>

<style>
	.menue {
		position: absolute;
		z-index: 15;
		top: calc(env(safe-area-inset-top) + 12px);
		right: 12px;
	}
	.haupt {
		position: relative;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 1px solid var(--linie);
		border-radius: 22px;
		background: var(--flaeche);
		color: var(--text);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
	}
	.haupt.an {
		background: var(--text);
		color: var(--flaeche);
	}
	.punkt {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--signal);
		border: 2px solid var(--flaeche);
	}
	.liste {
		position: absolute;
		top: 52px;
		right: 0;
		min-width: 230px;
		padding: 6px;
		border: 1px solid var(--linie);
		border-radius: var(--radius-gross);
		background: var(--flaeche);
		box-shadow: var(--schatten-dialog);
	}
	.liste button {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		height: 46px;
		padding: 0 12px;
		border: 0;
		border-radius: var(--radius);
		background: none;
		font-size: 15px;
		font-weight: 520;
		text-align: left;
	}
	.liste button:active,
	.liste button:hover {
		background: var(--flaeche-2);
	}
	.liste :global(.haken) {
		margin-left: auto;
		color: var(--stern);
	}
	.dreht {
		display: grid;
		animation: puls 1s ease-in-out infinite;
	}
	@keyframes puls {
		50% {
			opacity: 0.3;
		}
	}
</style>
