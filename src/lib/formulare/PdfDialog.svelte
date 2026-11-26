<!--
  Reise als PDF: auswählen, was hinein soll, erstellen, dann mit einem zweiten Tipp teilen
  (das iPhone öffnet das Teilen-Menü nur direkt nach einem Tipp, nicht nach langem Rechnen).
-->
<script lang="ts">
	import FilePdf from 'phosphor-svelte/lib/FilePdf';
	import Export from 'phosphor-svelte/lib/Export';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { fotosVon } from '#lib/auswertung.ts';
	import { reiseKosten } from '#lib/kosten.svelte.ts';
	import DownloadSimple from 'phosphor-svelte/lib/DownloadSimple';
	import { dateiTeilen, herunterladen, mitFinger, kannTeilen } from '#lib/db/sicherung.ts';
	import type { PdfWahl } from '#lib/pdf/reisePdf.ts';

	let { reise }: { reise: string } = $props();
	// svelte-ignore state_referenced_locally
	const r = daten.reise(reise);
	// svelte-ignore state_referenced_locally
	const anzahlFotos = fotosVon(reise).length;
	// svelte-ignore state_referenced_locally
	const hatKosten = reiseKosten(reise).length > 0;

	const WAHL_KEY = 'reiseblog-pdf';
	const gemerkt = (() => {
		try {
			return JSON.parse(localStorage.getItem(WAHL_KEY) ?? 'null') as PdfWahl | null;
		} catch {
			return null;
		}
	})();
	// Kosten stehen absichtlich nie automatisch drin: das PDF ist zum Weitergeben gedacht
	let wahl = $state<PdfWahl>({ fotos: gemerkt?.fotos ?? true, texte: gemerkt?.texte ?? true, kosten: false });
	let laeuft = $state(false);
	let stand = $state('');
	let datei = $state<File | null>(null);
	let fehler = $state('');

	const zu = () => (ui.dialog = null);

	async function erstellen() {
		if (!r) return;
		laeuft = true;
		fehler = '';
		stand = 'PDF wird erstellt …';
		try {
			localStorage.setItem(WAHL_KEY, JSON.stringify({ fotos: wahl.fotos, texte: wahl.texte }));
		} catch {
			/* privater Modus */
		}
		try {
			const { reisePdf } = await import('#lib/pdf/reisePdf.ts');
			datei = await reisePdf(r, $state.snapshot(wahl), (n, von, text) => (stand = text ?? `Fotos ${n} von ${von} …`));
		} catch (e) {
			fehler = 'Das PDF konnte nicht erstellt werden: ' + (e as Error).message;
		} finally {
			laeuft = false;
			stand = '';
		}
	}

	const finger = mitFinger();
	async function teilen() {
		if (!datei) return;
		await dateiTeilen(datei);
		zu();
	}
	function laden() {
		if (!datei) return;
		herunterladen(datei);
		zu();
	}

	const groesse = (f: File) => (f.size > 1e6 ? `${(f.size / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB` : `${Math.ceil(f.size / 1e3)} KB`);
</script>

<Dialog titel="Als PDF" onschliessen={zu}>
	{#if datei}
		<div class="fertig">
			<span class="symbol"><FilePdf size={34} weight="duotone" /></span>
			<p><b>{datei.name}</b><br /><span class="grau">{groesse(datei)}</span></p>
			<p class="grau">
				{finger ? 'Fertig. Über „Teilen“ kannst du es verschicken oder z. B. in „Dateien“ sichern.' : 'Fertig. „Herunterladen“ legt es in deinen Download-Ordner.'}
			</p>
		</div>
	{:else}
		<p class="einleitung">„{r?.titel}“ als PDF zum Verschicken oder Ausdrucken: Tag für Tag, mit Karte der Route.</p>
		{#if anzahlFotos}
			<label class="schalter">
				<span>Fotos<small>{anzahlFotos} {anzahlFotos === 1 ? 'Foto' : 'Fotos'} – größere Datei</small></span>
				<input type="checkbox" bind:checked={wahl.fotos} disabled={laeuft} />
			</label>
		{/if}
		<label class="schalter">
			<span>Texte und Notizen<small>Beschreibungen und Notizen zu den Nächten</small></span>
			<input type="checkbox" bind:checked={wahl.texte} disabled={laeuft} />
		</label>
		{#if hatKosten}
			<label class="schalter">
				<span>Kosten<small>Preise und Ausgaben – nur wenn du sie mitschicken willst</small></span>
				<input type="checkbox" bind:checked={wahl.kosten} disabled={laeuft} />
			</label>
		{/if}
		{#if stand}<p class="grau">{stand}</p>{/if}
		{#if fehler}<p class="fehler">{fehler}</p>{/if}
	{/if}

	{#snippet fuss()}
		{#if datei && !finger}
			<!-- PC: Herunterladen, Teilen nur, wo der Browser es anbietet -->
			{#if kannTeilen(datei)}<button class="knopf zweit" onclick={teilen}><Export size={18} /> Teilen</button>{/if}
			<button class="knopf" onclick={laden}><DownloadSimple size={18} /> Herunterladen</button>
		{:else if datei}
			<button class="knopf zweit" onclick={zu}>Schließen</button>
			<button class="knopf" onclick={teilen}><Export size={18} /> Teilen</button>
		{:else}
			<button class="knopf zweit" onclick={zu}>Abbrechen</button>
			<button class="knopf" onclick={erstellen} disabled={laeuft}>{laeuft ? 'Einen Moment …' : 'PDF erstellen'}</button>
		{/if}
	{/snippet}
</Dialog>

<style>
	.einleitung {
		margin: 0 0 14px;
		line-height: 1.45;
	}
	.grau {
		color: var(--text-2);
		font-size: 14px;
	}
	.fehler {
		color: var(--gefahr);
		font-size: 14px;
	}
	.fertig {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 0 6px;
		text-align: center;
	}
	.fertig p {
		margin: 4px 0;
		line-height: 1.4;
	}
	.symbol {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: var(--radius-gross);
		background: var(--flaeche-2);
		color: var(--gefahr);
	}
</style>
