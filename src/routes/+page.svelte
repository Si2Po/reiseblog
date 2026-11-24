<!-- Vorläufige Startseite: Design-Entwürfe im Vergleich. -->
<script lang="ts">
	import { stile } from '#lib/entwurf/stile.ts';

	const haupt = stile.filter((s) => !s.id.startsWith('mix-') && s.id !== 'mix');
	const dunkel = stile.filter((s) => s.id.startsWith('mix'));
</script>

<main>
	<header>
		<h1>Reiseblog – Dunkelmodus für Entwurf D</h1>
		<p>
			Hell bleibt wie D. Für dunkel gibt es vier Varianten. Alles ist anklickbar; der Knopf mit Sonne/Mond an der Karte
			schaltet zwischen hell und dunkel.
		</p>
	</header>
	<div class="reihe">
		{#each dunkel as s, i (s.id)}
			<section>
				<a class="titel" href="#/entwurf/{s.id}/dunkel"><b>{i + 1}</b> {s.id === 'mix' ? 'Wald (bisher)' : s.name}</a>
				<p>{s.id === 'mix' ? 'Dunkles Grau-Grün, Mintgrün als Akzent – der bisherige Stand.' : s.idee}</p>
				<iframe title={s.name} src="{location.pathname}#/entwurf/{s.id}/dunkel"></iframe>
			</section>
		{/each}
	</div>

	<header class="zweit">
		<h2>Die ersten Entwürfe</h2>
	</header>
	<div class="reihe">
		{#each haupt as s (s.id)}
			<section>
				<a class="titel" href="#/entwurf/{s.id}"><b>{s.buchstabe}</b> {s.name}</a>
				<p>{s.idee}</p>
				<iframe title={s.name} src="{location.pathname}#/entwurf/{s.id}" loading="lazy"></iframe>
			</section>
		{/each}
	</div>
</main>

<style>
	main {
		height: 100%;
		overflow: auto;
		padding: 28px 24px 40px;
		background: #ecebe7;
		color: #1d1d1b;
		font-family: 'Instrument Sans Variable', system-ui, sans-serif;
	}
	header {
		max-width: 760px;
		margin: 0 auto 24px;
		text-align: center;
	}
	header.zweit {
		margin-top: 56px;
	}
	h1 {
		font-size: 26px;
		margin-bottom: 8px;
	}
	h2 {
		font-size: 20px;
	}
	header p {
		color: #555;
	}
	.reihe {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 28px;
	}
	section {
		width: 375px;
	}
	.titel {
		display: flex;
		align-items: center;
		gap: 8px;
		color: inherit;
		text-decoration: none;
		font-weight: 650;
		font-size: 18px;
	}
	.titel b {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 14px;
		background: #1d1d1b;
		color: #fff;
		font-size: 14px;
	}
	section p {
		min-height: 44px;
		margin: 6px 0 12px;
		font-size: 14px;
		color: #555;
	}
	iframe {
		display: block;
		width: 375px;
		height: 812px;
		border: 0;
		border-radius: 36px;
		box-shadow:
			0 0 0 10px #1d1d1b,
			0 20px 50px rgba(0, 0, 0, 0.25);
		background: #fff;
	}
</style>
