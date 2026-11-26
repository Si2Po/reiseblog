<!--
  Sicherung als Datei: immer mit Passwort verschlüsselt. Erst erstellen, dann mit einem
  zweiten Tipp teilen/sichern (das iPhone erlaubt das Teilen-Menü nur direkt nach einem Tipp).
  Logik in src/lib/db/sicherung.ts.
-->
<script lang="ts">
	import { slide } from 'svelte/transition';
	import DownloadSimple from 'phosphor-svelte/lib/DownloadSimple';
	import UploadSimple from 'phosphor-svelte/lib/UploadSimple';
	import Export from 'phosphor-svelte/lib/Export';
	import { ui } from '#lib/ui.svelte.ts';
	import { sicherungErstellen, sicherungPruefen, sicherungEinlesen, dateiTeilen, herunterladen, mitFinger, kannTeilen } from '#lib/db/sicherung.ts';

	type Schritt = 'nichts' | 'sichern' | 'fertig' | 'einlesen';
	let schritt = $state<Schritt>('nichts');
	let pw = $state('');
	let pw2 = $state('');
	let laeuft = $state(false);
	let fehler = $state('');
	let fertig = $state<File | null>(null);
	let gewaehlt: File | null = null;
	let eingabe: HTMLInputElement | undefined = $state();

	const pwOk = $derived(pw.length >= 8 && pw === pw2);

	function zurueck() {
		schritt = 'nichts';
		pw = pw2 = fehler = '';
		fertig = gewaehlt = null;
	}

	async function erstellen() {
		laeuft = true;
		fehler = '';
		try {
			fertig = await sicherungErstellen(pw);
			pw = pw2 = '';
			schritt = 'fertig';
		} catch (e) {
			fehler = (e as Error).message;
		} finally {
			laeuft = false;
		}
	}

	const finger = mitFinger();
	async function teilen() {
		if (fertig) await dateiTeilen(fertig);
		zurueck();
	}
	function laden() {
		if (fertig) herunterladen(fertig);
		zurueck();
	}

	async function einlesen(passwort?: string) {
		if (!gewaehlt) return;
		laeuft = true;
		fehler = '';
		try {
			const n = await sicherungEinlesen(gewaehlt, passwort);
			ui.zeige(`${n} ${n === 1 ? 'Datensatz' : 'Datensätze'} eingelesen`);
			zurueck();
		} catch (e) {
			fehler = (e as Error).message;
		} finally {
			laeuft = false;
		}
	}

	async function dateiGewaehlt(e: Event) {
		const input = e.target as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (!f) return;
		try {
			const { verschluesselt } = await sicherungPruefen(f);
			gewaehlt = f;
			if (verschluesselt) {
				pw = fehler = '';
				schritt = 'einlesen';
			} else await einlesen();
		} catch (err) {
			ui.zeige((err as Error).message);
		}
	}
</script>

<section>
	<h4>Sicherung</h4>
	{#if schritt === 'nichts'}
		<div class="zeile">
			<button class="knopf zweit" onclick={() => (schritt = 'sichern')}><DownloadSimple size={18} /> Als Datei sichern</button>
			<button class="knopf zweit" onclick={() => eingabe?.click()}><UploadSimple size={18} /> Einlesen</button>
		</div>
		<p class="hilfe">Sichert Reisen, Einträge, Plätze und Ziele (ohne Fotos) verschlüsselt als Datei. Einlesen ergänzt und überschreibt gleiche Einträge.</p>
	{:else if schritt === 'sichern'}
		<form
			transition:slide={{ duration: 180 }}
			onsubmit={(e) => {
				e.preventDefault();
				if (pwOk) erstellen();
			}}
		>
			<p class="hilfe oben">Die Datei wird mit einem Passwort verschlüsselt. Ohne dieses Passwort lässt sie sich nicht mehr öffnen – gern dein Tagebuch-Passwort.</p>
			<label class="feld"><span class="name">Passwort für die Sicherung</span><input type="password" autocomplete="new-password" bind:value={pw} /></label>
			<label class="feld"><span class="name">Noch einmal</span><input type="password" autocomplete="new-password" bind:value={pw2} /></label>
			{#if pw && pw.length < 8}<p class="hinweis">Mindestens 8 Zeichen.</p>{/if}
			{#if pw2 && pw !== pw2}<p class="hinweis">Die beiden Eingaben sind verschieden.</p>{/if}
			{#if fehler}<p class="hinweis fehler">{fehler}</p>{/if}
			<div class="zeile">
				<button type="button" class="knopf zweit" onclick={zurueck}>Abbrechen</button>
				<button class="knopf" type="submit" disabled={!pwOk || laeuft}>{laeuft ? 'Einen Moment …' : 'Sicherung erstellen'}</button>
			</div>
		</form>
	{:else if schritt === 'fertig'}
		<div transition:slide={{ duration: 180 }}>
			<p class="hilfe oben">Die Sicherung ist fertig.{finger ? ' Im Teilen-Menü z. B. „In Dateien sichern“ wählen.' : ''}</p>
			<div class="zeile">
				<button class="knopf zweit" onclick={zurueck}>Abbrechen</button>
				{#if finger}
					<button class="knopf" onclick={teilen}><Export size={18} /> Datei sichern</button>
				{:else}
					{#if fertig && kannTeilen(fertig)}<button class="knopf zweit" onclick={teilen}><Export size={18} /> Teilen</button>{/if}
					<button class="knopf" onclick={laden}><DownloadSimple size={18} /> Herunterladen</button>
				{/if}
			</div>
		</div>
	{:else}
		<form
			transition:slide={{ duration: 180 }}
			onsubmit={(e) => {
				e.preventDefault();
				if (pw) einlesen(pw);
			}}
		>
			<p class="hilfe oben">Diese Sicherung ist verschlüsselt.</p>
			<label class="feld"><span class="name">Passwort der Sicherung</span><input type="password" autocomplete="current-password" bind:value={pw} /></label>
			{#if fehler}<p class="hinweis fehler">{fehler}</p>{/if}
			<div class="zeile">
				<button type="button" class="knopf zweit" onclick={zurueck}>Abbrechen</button>
				<button class="knopf" type="submit" disabled={!pw || laeuft}>{laeuft ? 'Einen Moment …' : 'Einlesen'}</button>
			</div>
		</form>
	{/if}
	<input bind:this={eingabe} type="file" accept="application/json,.json" hidden onchange={dateiGewaehlt} />
</section>

<style>
	.oben {
		margin: 0 0 12px;
	}
	.hinweis {
		margin: -8px 0 12px;
		font-size: 14px;
		color: var(--text-2);
	}
	.fehler {
		color: var(--gefahr);
	}
</style>
