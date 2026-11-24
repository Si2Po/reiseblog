<!-- Vorläufige Startseite: die drei Design-Entwürfe im Vergleich. -->
<script lang="ts">
	import { stile } from '#lib/entwurf/stile.ts';
</script>

<main>
	<header>
		<h1>Reiseblog – drei Stilrichtungen</h1>
		<p>
			Gleicher Aufbau, drei Stile. Alles ist anklickbar: Reise antippen, Zeitleiste, Platz, Fotos-Knopf oben rechts,
			„Hier eintragen“. Das Sheet unten lässt sich wischen. Am iPhone: einen Entwurf öffnen, oben links wechselt der Stil.
		</p>
	</header>
	<div class="reihe">
		{#each stile as s (s.id)}
			<section>
				<a class="titel" href="#/entwurf/{s.id}"><b>{s.buchstabe}</b> {s.name}</a>
				<p>{s.idee}</p>
				<iframe title={s.name} src="{location.pathname}#/entwurf/{s.id}"></iframe>
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
	h1 {
		font-size: 26px;
		margin-bottom: 8px;
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
