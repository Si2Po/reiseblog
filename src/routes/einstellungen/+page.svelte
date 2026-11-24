<!-- Einstellungen: Darstellung, Daten sichern, Beispieldaten. Konto/Teilen folgen mit dem Abgleich. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import DownloadSimple from 'phosphor-svelte/lib/DownloadSimple';
	import UploadSimple from 'phosphor-svelte/lib/UploadSimple';
	import Kopf from '#lib/ui/Kopf.svelte';
	import { thema, type ThemaWahl } from '#lib/thema.svelte.ts';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { beispielLaden, beispielEntfernen, hatBeispiel } from '#lib/beispiel/daten.ts';
	import { sicherungHerunterladen, sicherungEinlesen } from '#lib/db/sicherung.ts';

	onMount(() => {
		ui.auswahl = null;
	});

	const WAHL: { w: ThemaWahl; name: string }[] = [
		{ w: 'auto', name: 'Automatisch' },
		{ w: 'hell', name: 'Hell' },
		{ w: 'dunkel', name: 'Dunkel' }
	];

	let datei: HTMLInputElement | undefined = $state();
	async function einlesen(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (!f) return;
		try {
			const n = await sicherungEinlesen(f);
			ui.zeige(`${n} Datensätze eingelesen`);
		} catch (err) {
			ui.zeige((err as Error).message);
		}
		(e.target as HTMLInputElement).value = '';
	}
</script>

<Kopf />

<div class="seite">
	<h1>Einstellungen</h1>

	<section>
		<h4>Darstellung</h4>
		<div class="segment" role="radiogroup" aria-label="Darstellung">
			{#each WAHL as x (x.w)}
				<button role="radio" aria-checked={thema.wahl === x.w} class:an={thema.wahl === x.w} onclick={() => thema.setzen(x.w)}>{x.name}</button>
			{/each}
		</div>
		<p class="hilfe">„Automatisch“ folgt der Einstellung des iPhones bzw. Computers.</p>
	</section>

	<section>
		<h4>Konto und Teilen</h4>
		<p class="hilfe">Kommt als Nächstes: Anmeldung, Abgleich zwischen iPhone und PC, Teilen-Links. Bis dahin bleiben alle Daten nur auf diesem Gerät.</p>
	</section>

	<section>
		<h4>Sicherung</h4>
		<div class="zeile">
			<button class="knopf zweit" onclick={sicherungHerunterladen}><DownloadSimple size={18} /> Als Datei sichern</button>
			<button class="knopf zweit" onclick={() => datei?.click()}><UploadSimple size={18} /> Einlesen</button>
			<input bind:this={datei} type="file" accept="application/json,.json" hidden onchange={einlesen} />
		</div>
		<p class="hilfe">Sichert Reisen, Einträge und Plätze (ohne Fotos) als Datei. Einlesen ergänzt und überschreibt gleiche Einträge.</p>
	</section>

	<section>
		<h4>Beispieldaten</h4>
		{#if hatBeispiel()}
			<button class="knopf zweit" onclick={async () => ui.zeige('Beispieldaten entfernt', await beispielEntfernen())}>Beispielreisen entfernen</button>
		{:else}
			<button class="knopf zweit" onclick={beispielLaden}>Beispielreisen laden</button>
		{/if}
		<p class="hilfe">Drei erfundene Reisen zum Ausprobieren. Lassen sich jederzeit wieder entfernen, eigene Daten bleiben unberührt.</p>
	</section>

	<p class="fuss zahl">{daten.reisen.length} Reisen · {daten.eintraege.length} Einträge · {daten.plaetze.length} Plätze · {daten.fotos.length} Fotos</p>
</div>

<style>
	.seite {
		padding: 0 18px;
	}
	h1 {
		font-size: 30px;
		margin: 4px 0 8px;
	}
	section {
		padding: 14px 0;
		border-bottom: 1px solid var(--linie);
	}
	h4 {
		margin: 0 0 10px;
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-2);
	}
	.segment {
		display: flex;
		gap: 4px;
		padding: 4px;
		border-radius: calc(var(--radius) + 2px);
		background: var(--flaeche-2);
	}
	.segment button {
		flex: 1;
		height: 40px;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--text-2);
		font-weight: 560;
	}
	.segment button.an {
		background: var(--flaeche);
		color: var(--text);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.zeile .knopf {
		flex: 1;
	}
	.hilfe {
		margin-top: 8px;
		color: var(--text-2);
		font-size: 14px;
		line-height: 1.45;
	}
	.fuss {
		padding: 18px 0;
		color: var(--text-2);
		font-size: 13px;
	}
</style>
