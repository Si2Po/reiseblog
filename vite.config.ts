import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Auf GitHub Pages liegt die App unter /reiseblog, lokal unter /.
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Reine Single-Page-App: alles läuft im Browser, GitHub Pages liefert nur Dateien aus.
			adapter: adapter({ fallback: 'index.html' }),
			paths: { base },
			// Hash-Router (#/urlaub/…): keine 404-Tricks auf GitHub Pages, Home-Bildschirm-App bleibt stabil.
			router: { type: 'hash' }
		})
	],
	worker: { format: 'es' },
	server: { host: true }
});
