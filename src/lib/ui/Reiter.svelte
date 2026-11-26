<!-- Hauptbereiche (Reisen, Plätze, Ziele, Fotos) plus Suche und Zahnrad als Symbole. Bleibt beim Scrollen oben. -->
<script lang="ts">
	import { pfeile } from '#lib/ui/pfeile.ts';
	import { page } from '$app/state';
	import MapTrifold from 'phosphor-svelte/lib/MapTrifold';
	import Tent from 'phosphor-svelte/lib/Tent';
	import Flag from 'phosphor-svelte/lib/Flag';
	import Images from 'phosphor-svelte/lib/Images';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import GearSix from 'phosphor-svelte/lib/GearSix';
	import { ui } from '#lib/ui.svelte.ts';
	import { daten } from '#lib/db/daten.svelte.ts';

	const aktiv = $derived(page.route.id);
</script>

<nav class="reiter" aria-label="Bereiche">
	<div class="gruppe" {@attach pfeile('a', 'zeile')}>
		<a href="#/" class:aktiv={aktiv === '/' || aktiv === '/statistik'}><MapTrifold size={18} /> Reisen</a>
		<a href="#/plaetze" class:aktiv={aktiv === '/plaetze'}><Tent size={18} /> Plätze</a>
		<a href="#/ziele" class:aktiv={aktiv === '/ziele'}><Flag size={18} /> Ziele</a>
		<a href="#/fotos" class:aktiv={aktiv === '/fotos'}><Images size={18} /> Fotos</a>
	</div>
	<a class="symbol" href="#/suche" class:aktiv={aktiv === '/suche'} onclick={() => !ui.breit && (ui.hoehe = 'voll')} aria-label="Suche"><MagnifyingGlass size={20} /></a>
	<a class="symbol" href="#/einstellungen" class:aktiv={aktiv === '/einstellungen'} aria-label="Einstellungen"><GearSix size={20} /></a>
</nav>

<style>
	.reiter {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		gap: 8px;
		padding: 2px 14px 10px;
		background: var(--flaeche);
		/* deckt den Innenabstand über der klebenden Leiste ab – sonst scrollt dort Inhalt durch */
		box-shadow: 0 -16px 0 var(--flaeche);
	}
	.gruppe {
		flex: 1;
		display: flex;
		gap: 4px;
		padding: 4px;
		border-radius: calc(var(--radius) + 2px);
		background: var(--flaeche-2);
	}
	a {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 38px;
		border-radius: var(--radius);
		color: var(--text-2);
		font-size: 15px;
		font-weight: 560;
		text-decoration: none;
	}
	a.aktiv {
		background: var(--flaeche);
		color: var(--text);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}
	.symbol {
		flex: none;
		width: 46px;
		height: 46px;
		border-radius: calc(var(--radius) + 2px);
		background: var(--flaeche-2);
	}
	.symbol.aktiv {
		color: var(--text);
		box-shadow: none;
		background: var(--linie);
	}
	/* Wenig Platz – iPhone bzw. die 400 px breite Seitenleiste am PC (ab 900 px): nur Wörter, ohne Symbole.
	   (Keine Container-Query: die bringt WebKit im Test durcheinander.) */
	@media (max-width: 480px), (min-width: 900px) {
		.gruppe a :global(svg) {
			display: none;
		}
		.gruppe a {
			font-size: 14.5px;
		}
	}
	@media (hover: hover) {
		.gruppe a:not(.aktiv):hover,
		.symbol:hover {
			color: var(--text);
		}
	}
</style>
