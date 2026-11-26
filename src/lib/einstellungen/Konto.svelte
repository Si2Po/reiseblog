<!-- Konto: anmelden / Konto anlegen / Abgleich-Status / Verschlüsselung (Tresor). -->
<script lang="ts">
	import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import { abgleich, wartetText } from '#lib/db/abgleich.svelte.ts';
	import { tresor } from '#lib/db/tresor.svelte.ts';
	import Tresor from './Tresor.svelte';
	import { ui } from '#lib/ui.svelte.ts';
	import { formatDistanceToNow } from 'date-fns';
	import { de } from 'date-fns/locale';

	let email = $state('');
	let passwort = $state('');
	let laeuft = $state(false);
	let fehler = $state('');

	async function los(neu: boolean) {
		fehler = '';
		laeuft = true;
		try {
			await abgleich.anmelden(email.trim(), passwort, neu);
			passwort = '';
			ui.zeige(neu ? 'Konto angelegt' : 'Angemeldet');
		} catch (e) {
			fehler = (e as Error).message;
		} finally {
			laeuft = false;
		}
	}
	const ok = $derived(/.+@.+\..+/.test(email.trim()) && passwort.length >= 6);
</script>

<section>
	<h4>Konto und Abgleich</h4>
	{#if !abgleich.moeglich}
		<p class="hilfe">
			Noch nicht eingerichtet – alle Daten bleiben vorerst nur auf diesem Gerät. Zum Einrichten siehe <b>supabase/ANLEITUNG.md</b>.
		</p>
	{:else if abgleich.email}
		<div class="status">
			{#if abgleich.fehler}
				<WarningCircle size={22} weight="fill" class="warn" />
			{:else}
				<CheckCircle size={22} weight="fill" class="gut" />
			{/if}
			<span class="txt">
				<b>{abgleich.email}</b>
				<span>
					{#if !tresor.offen}Wartet auf die Verschlüsselung
					{:else if abgleich.laeuft}Wird abgeglichen …
					{:else if abgleich.fehler}{abgleich.fehler}
					{:else if abgleich.wartet}{wartetText(abgleich.wartet)}{navigator.onLine ? '' : ' (kein Internet)'}
					{:else if abgleich.zuletzt}Abgeglichen {formatDistanceToNow(abgleich.zuletzt, { locale: de, addSuffix: true })}
					{:else}Noch nicht abgeglichen{/if}
				</span>
			</span>
		</div>
		<Tresor />
		<div class="zeile">
			<button class="knopf zweit" onclick={() => abgleich.jetzt()} disabled={abgleich.laeuft || !tresor.offen}>
				<ArrowsClockwise size={18} /> Abgleichen
			</button>
			<button class="knopf still" onclick={() => abgleich.abmelden()}>Abmelden</button>
		</div>
		<p class="hilfe">Wer sich mit demselben Konto anmeldet und das Tagebuch-Passwort kennt (z. B. deine Partnerin), sieht und bearbeitet dieselben Reisen. Beim Abmelden wird der Schlüssel von diesem Gerät entfernt; die Reisen bleiben hier.</p>
	{:else}
		<form
			onsubmit={(e) => {
				e.preventDefault();
				los(false);
			}}
		>
			<label class="feld"><span class="name">E-Mail</span><input type="email" autocomplete="email" bind:value={email} /></label>
			<label class="feld"
				><span class="name">Passwort</span><input type="password" autocomplete="current-password" bind:value={passwort} minlength="6" /></label
			>
			{#if fehler}<p class="fehler">{fehler}</p>{/if}
			<div class="zeile">
				<button class="knopf" type="submit" disabled={!ok || laeuft}>Anmelden</button>
				<button class="knopf zweit" type="button" disabled={!ok || laeuft} onclick={() => los(true)}>Konto anlegen</button>
			</div>
		</form>
		<p class="hilfe">Mit Konto sind deine Reisen auf iPhone und PC gleich und Fotos werden online gesichert – Ende-zu-Ende verschlüsselt, nur du kannst sie lesen.</p>
	{/if}
</section>

<style>
	.status {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}
	.status :global(.gut) {
		color: var(--stern);
	}
	.status :global(.warn) {
		color: var(--gefahr);
	}
	.txt {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.txt span {
		color: var(--text-2);
		font-size: 14px;
	}
	.fehler {
		margin: -4px 0 12px;
		color: var(--gefahr);
		font-size: 14px;
	}
</style>
