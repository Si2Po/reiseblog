<!-- Kompakte Ortssuche über der Karte (z. B. beim „Ort auf der Karte wählen“). Treffer → Karte springt hin. -->
<script lang="ts">
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import X from 'phosphor-svelte/lib/X';
	import { ortSuchen, type Vorschlag } from '#lib/geo/dienste.ts';
	import { ui } from '#lib/ui.svelte.ts';

	let { onwahl, platzhalter = 'Ort suchen, z. B. Deutsches Museum München' }: { onwahl: (v: Vorschlag) => void; platzhalter?: string } = $props();

	let text = $state('');
	let liste = $state<Vorschlag[]>([]);
	let sucht = $state(false);
	let timer: ReturnType<typeof setTimeout>;
	let abbruch: AbortController | null = null;

	function tippen() {
		clearTimeout(timer);
		abbruch?.abort();
		const q = text.trim();
		if (q.length < 2) return (liste = []);
		timer = setTimeout(async () => {
			sucht = true;
			abbruch = new AbortController();
			try {
				liste = await ortSuchen(q, ui.karte?.mitte() ?? undefined, abbruch.signal);
			} catch (e) {
				if ((e as Error).name !== 'AbortError') ui.zeige((e as Error).message);
			} finally {
				sucht = false;
			}
		}, 280);
	}

	function waehlen(v: Vorschlag) {
		text = v.name ?? '';
		liste = [];
		(document.activeElement as HTMLElement | null)?.blur();
		onwahl(v);
	}
</script>

<div class="suche">
	<label class="feld-zeile">
		<MagnifyingGlass size={18} />
		<input
			type="search"
			placeholder={platzhalter}
			bind:value={text}
			oninput={tippen}
			enterkeyhint="search"
			autocomplete="off"
			onkeydown={(e) => e.key === 'Enter' && liste[0] && waehlen(liste[0])}
		/>
		{#if text}<button type="button" class="leeren" onclick={() => ((text = ''), (liste = []))} aria-label="Leeren"><X size={14} /></button>{/if}
	</label>
	{#if liste.length || sucht}
		<ul class="treffer">
			{#if sucht && !liste.length}<li class="lade">Suche …</li>{/if}
			{#each liste as v, i (i)}
				<li>
					<button type="button" onclick={() => waehlen(v)}>
						<b>{v.name}</b>
						<span>{v.zusatz}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.suche {
		position: relative;
	}
	.feld-zeile {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 48px;
		padding: 0 6px 0 14px;
		border: 1px solid var(--linie);
		border-radius: 24px;
		background: var(--flaeche);
		color: var(--text-2);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
	}
	input {
		flex: 1;
		min-width: 0;
		height: 44px;
		border: 0;
		outline: 0;
		background: none;
		color: var(--text);
	}
	.leeren {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: 50%;
		background: var(--flaeche-2);
		color: var(--text);
	}
	.treffer {
		position: absolute;
		top: 54px;
		left: 0;
		right: 0;
		max-height: 50vh;
		overflow-y: auto;
		margin: 0;
		padding: 4px;
		list-style: none;
		border: 1px solid var(--linie);
		border-radius: var(--radius-gross);
		background: var(--flaeche);
		box-shadow: var(--schatten-dialog);
	}
	.treffer button {
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 9px 12px;
		border: 0;
		border-radius: var(--radius);
		background: none;
		text-align: left;
	}
	.treffer button:hover,
	.treffer button:active {
		background: var(--flaeche-2);
	}
	.treffer span,
	.lade {
		font-size: 13px;
		color: var(--text-2);
	}
	.lade {
		padding: 9px 12px;
	}
</style>
