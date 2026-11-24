<!-- Stellplatz bearbeiten (Name, Art, Ort, Ausstattung, Notiz). -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import Trash from 'phosphor-svelte/lib/Trash';
	import Dialog from '#lib/ui/Dialog.svelte';
	import OrtFeld from './OrtFeld.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { besuche } from '#lib/auswertung.ts';
	import { AUSSTATTUNG } from '#lib/ausstattung.ts';
	import { PLATZ_ART, type Ort, type PlatzArt } from '#lib/db/typen.ts';

	let { id }: { id: string } = $props();
	// svelte-ignore state_referenced_locally
	const alt = daten.platz(id)!;

	let name = $state(alt.name);
	let art = $state<PlatzArt>(alt.art);
	let ort = $state<Ort | undefined>(alt.ort);
	let ausstattung = $state<string[]>([...alt.ausstattung]);
	let untergrund = $state(alt.untergrund ?? '');
	let url = $state(alt.url ?? '');
	let notiz = $state(alt.notiz ?? '');
	let wiederkommen = $state(!!alt.wiederkommen);

	const ok = $derived(name.trim().length > 0 && !!ort);
	const zu = () => (ui.dialog = null);
	const umschalten = (k: string) => (ausstattung = ausstattung.includes(k) ? ausstattung.filter((x) => x !== k) : [...ausstattung, k]);

	async function speichern() {
		if (!ok) return;
		await daten.speichern('plaetze', {
			...alt,
			name: name.trim(),
			art,
			ort: ort!,
			ausstattung,
			untergrund: untergrund.trim() || undefined,
			url: url.trim() ? (/^https?:\/\//.test(url.trim()) ? url.trim() : 'https://' + url.trim()) : undefined,
			notiz: notiz.trim() || undefined,
			wiederkommen
		});
		zu();
	}

	async function loeschen() {
		// Besuche bleiben als Übernachtungen erhalten, verlieren nur den Verweis
		const bs = besuche(alt.id);
		for (const b of bs) await daten.speichern('eintraege', { ...b, platz: undefined });
		const weg = await daten.loeschen('plaetze', alt.id);
		zu();
		goto('#/plaetze');
		ui.zeige(`„${alt.name}“ gelöscht`, async () => {
			await weg();
			for (const b of bs) await daten.speichern('eintraege', { ...b, platz: alt.id });
		});
	}
</script>

<Dialog titel="Platz bearbeiten" onschliessen={zu} versteckt={!!ui.ortWahl}>
	<form
		id="platzform"
		onsubmit={(e) => {
			e.preventDefault();
			speichern();
		}}
	>
		<label class="feld"><span class="name">Name</span><input bind:value={name} maxlength="80" /></label>
		<div class="feld">
			<span class="name">Art</span>
			<div class="chips umbruch">
				{#each Object.entries(PLATZ_ART) as [k, n] (k)}
					<button type="button" class:an={art === k} onclick={() => (art = k as PlatzArt)}>{n}</button>
				{/each}
			</div>
		</div>
		<OrtFeld bind:ort />
		<div class="feld">
			<span class="name">Ausstattung</span>
			<div class="chips umbruch">
				{#each AUSSTATTUNG as a (a.key)}
					<button type="button" class:an={ausstattung.includes(a.key)} onclick={() => umschalten(a.key)}><a.icon size={16} /> {a.name}</button>
				{/each}
			</div>
		</div>
		<label class="schalter">
			<span>Gern wieder<small>Platz für später merken</small></span>
			<input type="checkbox" bind:checked={wiederkommen} />
		</label>
		<div class="feldreihe">
			<label class="feld"><span class="name">Untergrund</span><input bind:value={untergrund} placeholder="Wiese, Schotter …" /></label>
		</div>
		<label class="feld"><span class="name">Webseite</span><input type="url" inputmode="url" bind:value={url} placeholder="camping-beispiel.de" /></label>
		<label class="feld"><span class="name">Notiz zum Platz</span><textarea bind:value={notiz} placeholder="Was man beim nächsten Mal wissen sollte"></textarea></label>
	</form>

	{#snippet fuss()}
		<button class="knopf gefahr fuss-links" onclick={loeschen} aria-label="Löschen"><Trash size={18} /></button>
		<button class="knopf zweit" onclick={zu}>Abbrechen</button>
		<button class="knopf" type="submit" form="platzform" disabled={!ok}>Speichern</button>
	{/snippet}
</Dialog>

<style>
	.chips.umbruch {
		flex-wrap: wrap;
	}
</style>
