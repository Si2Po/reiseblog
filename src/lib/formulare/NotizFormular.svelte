<!-- Schnelle Notiz zu einer Übernachtung (z. B. zur zweiten Nacht). Zeitpunkt wird vorgeschlagen, lässt sich ändern. -->
<script lang="ts">
	import { neueId } from '#lib/db/id.ts';
	import { format } from 'date-fns';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { tagLang, plusTage } from '#lib/datum.ts';

	let { eintrag, datum }: { eintrag: string; datum: string } = $props();
	// svelte-ignore state_referenced_locally
	const e = daten.eintrag(eintrag);

	// Heute ist diese Nacht (oder der Morgen danach)? Dann „jetzt“, sonst abends an diesem Tag.
	const jetzt = new Date();
	const heute = format(jetzt, 'yyyy-MM-dd');
	// svelte-ignore state_referenced_locally
	const passt = heute === datum || heute === plusTage(datum, 1);
	// svelte-ignore state_referenced_locally
	let zeit = $state(passt ? format(jetzt, "yyyy-MM-dd'T'HH:mm") : `${datum}T21:00`);
	let text = $state('');

	const zu = () => (ui.dialog = null);
	async function speichern() {
		if (!e || !text.trim()) return;
		await daten.speichern('eintraege', { ...e, notizen: [...(e.notizen ?? []), { id: neueId(), zeit, text: text.trim() }] });
		zu();
		ui.zeige('Notiz gespeichert');
	}
</script>

<Dialog titel="Notiz" onschliessen={zu}>
	<form
		id="notizform"
		onsubmit={(ev) => {
			ev.preventDefault();
			speichern();
		}}
	>
		<p class="bezug">{e?.titel} · Nacht vom {tagLang(datum)}</p>
		<label class="feld">
			<span class="name">Was gibt’s?</span>
			<!-- svelte-ignore a11y_autofocus -->
			<textarea bind:value={text} placeholder="z. B. Nachbarn laut, Sonnenuntergang toll, Brötchen um 8 …" autofocus></textarea>
		</label>
		<label class="feld">
			<span class="name">Zeitpunkt</span>
			<input type="datetime-local" bind:value={zeit} />
		</label>
	</form>
	{#snippet fuss()}
		<button class="knopf zweit" onclick={zu}>Abbrechen</button>
		<button class="knopf" type="submit" form="notizform" disabled={!text.trim()}>Speichern</button>
	{/snippet}
</Dialog>

<style>
	.bezug {
		margin: -2px 0 14px;
		color: var(--text-2);
		font-size: 14px;
	}
</style>
