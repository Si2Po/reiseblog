<!--
  Verschlüsselung: einrichten (erstes Gerät), entsperren (weitere Geräte), Passwort ändern, Notfall-Code erneuern.
  Logik in src/lib/db/tresor.svelte.ts.
-->
<script lang="ts">
	import { slide } from 'svelte/transition';
	import LockKey from 'phosphor-svelte/lib/LockKey';
	import ShieldCheck from 'phosphor-svelte/lib/ShieldCheck';
	import Copy from 'phosphor-svelte/lib/Copy';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import { tresor } from '#lib/db/tresor.svelte.ts';
	import { abgleich } from '#lib/db/abgleich.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';

	let pw = $state('');
	let pw2 = $state('');
	let laeuft = $state(false);
	let fehler = $state('');
	/** frisch erzeugter Notfall-Code – wird genau einmal angezeigt */
	let code = $state<string | null>(null);
	let aufbewahrt = $state(false);
	/** nach Entsperren mit dem Notfall-Code: neues Passwort setzen */
	let neuesPasswort = $state(false);
	let mehr = $state(false);

	const pwOk = $derived(pw.length >= 8 && pw === pw2);

	async function mit<T>(f: () => Promise<T>): Promise<T | undefined> {
		fehler = '';
		laeuft = true;
		try {
			return await f();
		} catch (e) {
			fehler = (e as Error).message;
		} finally {
			laeuft = false;
		}
	}
	const client = async () => (await abgleich.client())!;

	async function einrichten() {
		const c = await mit(async () => tresor.einrichten(await client(), pw));
		if (c) {
			code = c;
			pw = pw2 = '';
		}
	}
	async function entsperren() {
		const art = await mit(async () => tresor.entsperren(await client(), pw));
		if (!art) return;
		pw = '';
		if (art === 'code') neuesPasswort = true;
		else ui.zeige('Entsperrt – alles wird abgeglichen');
		abgleich.tresorBereit();
	}
	async function passwortSetzen() {
		const ok = await mit(async () => (await tresor.passwortAendern(await client(), pw), true));
		if (!ok) return;
		pw = pw2 = '';
		neuesPasswort = false;
		mehr = false;
		ui.zeige('Neues Tagebuch-Passwort gilt ab jetzt auf allen Geräten');
	}
	async function codeErneuern() {
		const c = await mit(async () => tresor.codeErneuern(await client()));
		if (c) {
			code = c;
			aufbewahrt = false;
		}
	}
	async function fertig() {
		code = null;
		aufbewahrt = false;
		await abgleich.tresorBereit();
	}
	async function kopieren() {
		try {
			await navigator.clipboard.writeText(code!);
			ui.zeige('Notfall-Code kopiert – z. B. im Passwort-Manager ablegen');
		} catch {
			ui.zeige('Kopieren ging nicht – bitte abschreiben');
		}
	}
</script>

{#snippet neuesPw(knopf: string, los: () => void)}
	<form
		onsubmit={(e) => {
			e.preventDefault();
			if (pwOk) los();
		}}
	>
		<label class="feld"><span class="name">Tagebuch-Passwort</span><input type="password" autocomplete="new-password" bind:value={pw} /></label>
		<label class="feld"><span class="name">Noch einmal</span><input type="password" autocomplete="new-password" bind:value={pw2} /></label>
		{#if pw && pw.length < 8}<p class="hinweis">Mindestens 8 Zeichen – gern ein ganzer Satz.</p>{/if}
		{#if pw2 && pw !== pw2}<p class="hinweis">Die beiden Eingaben sind verschieden.</p>{/if}
		{#if fehler}<p class="fehler">{fehler}</p>{/if}
		<button class="knopf breit" type="submit" disabled={!pwOk || laeuft}>{laeuft ? 'Einen Moment …' : knopf}</button>
	</form>
{/snippet}

{#if code}
	<div class="box code-box">
		<h5><ShieldCheck size={20} weight="fill" /> Dein Notfall-Code</h5>
		<p>Damit kommst du an deine Daten, falls das Tagebuch-Passwort vergessen ist. <b>Er wird nur jetzt angezeigt.</b> Bewahre ihn sicher auf (Passwort-Manager, Ausdruck im Ordner) – wer ihn hat, kann dein Tagebuch lesen.</p>
		<code>{#each code.split('-') as g, i (i)}{#if i}-<wbr />{/if}{g}{/each}</code>
		<button class="knopf zweit" onclick={kopieren}><Copy size={18} /> Kopieren</button>
		<label class="schalter">
			<span>Ich habe den Code sicher aufbewahrt</span>
			<input type="checkbox" bind:checked={aufbewahrt} />
		</label>
		<button class="knopf breit" disabled={!aufbewahrt} onclick={fertig}>Fertig</button>
	</div>
{:else if tresor.status === 'pruefen'}
	<p class="hilfe">Verschlüsselung wird geprüft …</p>
{:else if tresor.status === 'einrichten'}
	<div class="box">
		<h5><LockKey size={20} weight="fill" /> Verschlüsselung einrichten</h5>
		<p>
			Deine Reisen und Fotos werden auf dem Gerät verschlüsselt, bevor sie hochgeladen werden – niemand außer dir kann sie lesen, auch nicht der Anbieter
			der Datenbank. Lege dafür ein <b>Tagebuch-Passwort</b> fest. Es ist nicht dein Anmelde-Passwort und wird nie verschickt. Jedes weitere Gerät braucht es
			einmal.
		</p>
		{@render neuesPw('Verschlüsselung einrichten', einrichten)}
	</div>
{:else if tresor.status === 'entsperren'}
	<div class="box">
		<h5><LockKey size={20} weight="fill" /> Tagebuch entsperren</h5>
		<p>Deine Daten auf dem Server sind verschlüsselt. Gib einmal das Tagebuch-Passwort (oder den Notfall-Code) ein – danach merkt sich dieses Gerät den Schlüssel.</p>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				if (pw) entsperren();
			}}
		>
			<label class="feld"><span class="name">Tagebuch-Passwort oder Notfall-Code</span><input type="password" autocomplete="current-password" bind:value={pw} /></label>
			{#if fehler}<p class="fehler">{fehler}</p>{/if}
			<button class="knopf breit" type="submit" disabled={!pw || laeuft}>{laeuft ? 'Einen Moment …' : 'Entsperren'}</button>
		</form>
	</div>
{:else if tresor.status === 'offen'}
	{#if neuesPasswort}
		<div class="box">
			<h5><LockKey size={20} weight="fill" /> Neues Tagebuch-Passwort</h5>
			<p>Mit dem Notfall-Code entsperrt. Lege jetzt ein neues Tagebuch-Passwort fest – es gilt dann auf allen Geräten.</p>
			{@render neuesPw('Passwort speichern', passwortSetzen)}
		</div>
	{:else}
		<button class="aufklapp" onclick={() => (mehr = !mehr)} aria-expanded={mehr}>
			<ShieldCheck size={18} weight="fill" class="gut" /> Ende-zu-Ende verschlüsselt
			<CaretDown size={14} style="margin-left:auto; transform: rotate({mehr ? 180 : 0}deg); transition: transform .2s" />
		</button>
		{#if mehr}
			<div transition:slide={{ duration: 180 }}>
				<p class="hilfe">Reisen, Notizen und Fotos werden auf dem Gerät verschlüsselt. Auf dem Server liegt nur Unlesbares.</p>
				<h5 class="klein">Tagebuch-Passwort ändern</h5>
				{@render neuesPw('Passwort ändern', passwortSetzen)}
				<button class="knopf still breit" onclick={codeErneuern} disabled={laeuft}>Neuen Notfall-Code erstellen</button>
			</div>
		{/if}
	{/if}
{/if}

<style>
	.box {
		margin: 4px 0 16px;
		padding: 14px;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}
	.code-box {
		border: 2px solid var(--signal);
	}
	h5 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 6px;
		font-size: 17px;
	}
	h5.klein {
		margin-top: 10px;
		font-size: 15px;
	}
	.box p {
		margin: 0 0 12px;
		line-height: 1.45;
		font-size: 15px;
	}
	code {
		display: block;
		margin: 4px 0 10px;
		padding: 12px;
		border-radius: var(--radius);
		background: var(--flaeche);
		font-size: 17px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-align: center;
		line-height: 1.5;
		user-select: all;
	}
	.code-box .knopf.zweit {
		margin-bottom: 8px;
	}
	.hinweis,
	.fehler {
		margin: -8px 0 12px;
		font-size: 14px;
		color: var(--text-2);
	}
	.fehler {
		color: var(--gefahr);
	}
	.breit {
		width: 100%;
	}
	.aufklapp :global(.gut) {
		color: var(--stern);
	}
	.knopf.still {
		margin-top: 8px;
	}
</style>
