<!--
  Teilen-Link anlegen/bearbeiten: für wen, welche Reisen, was zu sehen ist.
  Was nicht angehakt ist, filtert schon der Server heraus (freigabe_lesen in komplett.sql).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Trash from 'phosphor-svelte/lib/Trash';
	import ShareNetwork from 'phosphor-svelte/lib/ShareNetwork';
	import Copy from 'phosphor-svelte/lib/Copy';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { ui } from '#lib/ui.svelte.ts';
	import { abgleich, teilenLink, type Freigabe, type Umfang } from '#lib/db/abgleich.svelte.ts';
	import { reisenSortiert } from '#lib/auswertung.ts';

	let { token }: { token?: string } = $props();

	let alt = $state<Freigabe | null>(null);
	let name = $state('');
	let alleReisen = $state(true);
	let reisen = $state<string[]>([]);
	let u = $state<Omit<Umfang, 'reisen'>>({ plaetze: true, unterwegs: true, texte: true, preise: false, fotos: true });
	let aktiv = $state(true);
	let fertig = $state<Freigabe | null>(null);
	let speichert = $state(false);

	const eigeneReisen = reisenSortiert().filter((r) => !r.id.startsWith('bsp-'));

	onMount(async () => {
		if (!token) return;
		const f = (await abgleich.freigaben()).find((x) => x.token === token);
		if (!f) return;
		alt = f;
		name = f.name;
		alleReisen = f.umfang.reisen === 'alle';
		reisen = f.umfang.reisen === 'alle' ? [] : [...f.umfang.reisen];
		u = { plaetze: f.umfang.plaetze, unterwegs: f.umfang.unterwegs, texte: f.umfang.texte, preise: f.umfang.preise, fotos: f.umfang.fotos };
		aktiv = !f.widerrufen;
	});

	const VORLAGEN: { name: string; u: typeof u }[] = [
		{ name: 'Alles mit Fotos', u: { plaetze: true, unterwegs: true, texte: true, preise: true, fotos: true } },
		{ name: 'Nur Stellplätze', u: { plaetze: true, unterwegs: false, texte: false, preise: false, fotos: false } },
		{ name: 'Route ohne Fotos', u: { plaetze: true, unterwegs: true, texte: false, preise: false, fotos: false } }
	];
	const gleich = (a: typeof u, b: typeof u) => (Object.keys(a) as (keyof typeof u)[]).every((k) => a[k] === b[k]);

	const PUNKTE: { k: keyof typeof u; name: string; info: string }[] = [
		{ k: 'plaetze', name: 'Übernachtungen und Plätze', info: 'mit Bewertung und Ausstattung' },
		{ k: 'unterwegs', name: 'Fahrten, Ausflüge, Events', info: 'die Route auf der Karte' },
		{ k: 'fotos', name: 'Fotos', info: 'Fotos der freigegebenen Reisen' },
		{ k: 'texte', name: 'Texte und Notizen', info: 'Notizen von unterwegs, zu Reisen und Plätzen' },
		{ k: 'preise', name: 'Preise', info: 'was eine Nacht gekostet hat' }
	];

	const ok = $derived(name.trim().length > 0 && (alleReisen || reisen.length > 0) && (u.plaetze || u.unterwegs));
	const zu = () => (ui.dialog = null);

	async function speichern() {
		if (!ok) return;
		speichert = true;
		try {
			const f = await abgleich.freigabeSpeichern({
				token: alt?.token,
				name: name.trim(),
				umfang: { reisen: alleReisen ? 'alle' : reisen, ...u },
				widerrufen: !aktiv
			});
			ui.freigabenStand++;
			if (alt) {
				zu();
				ui.zeige(aktiv ? 'Link gespeichert' : 'Link ist jetzt abgeschaltet');
			} else fertig = f;
		} catch (e) {
			ui.zeige((e as Error).message);
		} finally {
			speichert = false;
		}
	}

	async function loeschen() {
		if (!alt) return;
		await abgleich.freigabeLoeschen(alt.token);
		ui.freigabenStand++;
		zu();
		ui.zeige(`Link für „${alt.name}“ gelöscht`);
	}

	async function weitergeben(f: Freigabe) {
		const url = teilenLink(f.token);
		if (navigator.share) {
			try {
				await navigator.share({ title: 'Unsere Reisen', text: `Unsere Camper-Reisen für ${f.name}`, url });
				return;
			} catch {
				/* abgebrochen → kopieren */
			}
		}
		await navigator.clipboard?.writeText(url);
		ui.zeige('Link kopiert');
	}
	const umschalten = (id: string) => (reisen = reisen.includes(id) ? reisen.filter((x) => x !== id) : [...reisen, id]);
</script>

<Dialog titel={fertig ? 'Link ist bereit' : alt ? 'Link bearbeiten' : 'Neuer Teilen-Link'} onschliessen={zu}>
	{#if fertig}
		<p class="hilfe">Wer diesen Link hat, sieht genau das, was du ausgewählt hast – ohne Anmeldung. Du kannst ihn jederzeit ändern oder abschalten.</p>
		<p class="link zahl">{teilenLink(fertig.token)}</p>
	{:else}
		<form
			id="freigabeform"
			onsubmit={(e) => {
				e.preventDefault();
				speichern();
			}}
		>
			<label class="feld">
				<span class="name">Für wen?</span>
				<input bind:value={name} placeholder="z. B. Max, Familie, Kollegen" maxlength="60" />
			</label>

			<div class="feld">
				<span class="name">Schnellwahl</span>
				<div class="chips umbruch">
					{#each VORLAGEN as v (v.name)}
						<button type="button" class:an={gleich(u, v.u)} onclick={() => (u = { ...v.u })}>{v.name}</button>
					{/each}
				</div>
			</div>

			<div class="feld">
				<span class="name">Was ist zu sehen?</span>
				{#each PUNKTE as x (x.k)}
					<label class="schalter">
						<span>{x.name}<small>{x.info}</small></span>
						<input type="checkbox" bind:checked={u[x.k]} />
					</label>
				{/each}
			</div>

			<div class="feld">
				<span class="name">Welche Reisen?</span>
				<label class="schalter">
					<span>Alle Reisen<small>auch alle künftigen</small></span>
					<input type="checkbox" bind:checked={alleReisen} />
				</label>
				{#if !alleReisen}
					<div class="chips umbruch">
						{#each eigeneReisen as r (r.id)}
							<button type="button" class:an={reisen.includes(r.id)} onclick={() => umschalten(r.id)}>{r.titel} {r.start.slice(0, 4)}</button>
						{/each}
					</div>
				{/if}
			</div>

			{#if alt}
				<label class="schalter">
					<span>Link aktiv<small>Ausschalten sperrt den Link sofort</small></span>
					<input type="checkbox" bind:checked={aktiv} />
				</label>
			{/if}
		</form>
	{/if}

	{#snippet fuss()}
		{#if fertig}
			<button class="knopf zweit" onclick={zu}>Fertig</button>
			<button class="knopf" onclick={() => weitergeben(fertig!)}>
				{#if 'share' in navigator}<ShareNetwork size={18} /> Senden{:else}<Copy size={18} /> Kopieren{/if}
			</button>
		{:else}
			{#if alt}<button class="knopf gefahr fuss-links" onclick={loeschen} aria-label="Löschen"><Trash size={18} /></button>{/if}
			<button class="knopf zweit" onclick={zu}>Abbrechen</button>
			<button class="knopf" type="submit" form="freigabeform" disabled={!ok || speichert}>{alt ? 'Speichern' : 'Link erstellen'}</button>
		{/if}
	{/snippet}
</Dialog>

<style>
	.hilfe {
		margin: 4px 0 8px;
		color: var(--text-2);
		font-size: 14px;
		line-height: 1.45;
	}
	.link {
		padding: 12px;
		border-radius: var(--radius);
		background: var(--flaeche-2);
		font-size: 14px;
		word-break: break-all;
		user-select: all;
	}
	.chips.umbruch {
		flex-wrap: wrap;
	}
</style>
