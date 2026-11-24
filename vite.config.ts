import adapter from '@sveltejs/adapter-static';
import { withPwa } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

// Auf GitHub Pages liegt die App unter /reiseblog, lokal unter /.
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;
const TAG = 60 * 60 * 24;

export default defineConfig({
	plugins: [
		withPwa(
			{
				compilerOptions: {
					runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
				},
				// Reine Single-Page-App: alles läuft im Browser, GitHub Pages liefert nur Dateien aus.
				adapter: adapter({ fallback: 'index.html' }),
				paths: { base },
				// Hash-Router (#/reise/…): keine 404-Tricks auf GitHub Pages, Home-Bildschirm-App bleibt stabil.
				router: { type: 'hash' }
			},
			{
				strategies: 'generateSW',
				// Neue Version: die App zeigt einen Hinweis, geladen wird erst auf Tippen
				registerType: 'prompt',
				injectRegister: false,
				kit: { adapterFallback: 'index.html', spa: true },
				manifest: {
					name: 'Reiseblog',
					short_name: 'Reiseblog',
					description: 'Camper-Reisetagebuch: Reisen, Stellplätze und Fotos auf der Karte',
					lang: 'de',
					start_url: `${base}/`,
					scope: `${base}/`,
					display: 'standalone',
					theme_color: '#f6f6f2',
					background_color: '#f6f6f2',
					icons: [
						{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
						{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
						{ src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
					]
				},
				generateSW: {
					globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
					navigateFallback: `${base}/index.html`,
					cleanupOutdatedCaches: true,
					runtimeCaching: [
						{
							// Kartenstil und Kachel-Übersicht: schnell aus dem Speicher, im Hintergrund auffrischen
							urlPattern: /^https:\/\/tiles\.openfreemap\.org\/(styles|planet$)/,
							handler: 'StaleWhileRevalidate',
							options: { cacheName: 'karte-stil', expiration: { maxEntries: 20, maxAgeSeconds: 30 * TAG } }
						},
						{
							// Kacheln, Schriften, Symbole: einmal geladen = offline verfügbar
							urlPattern: /^https:\/\/tiles\.openfreemap\.org\//,
							handler: 'CacheFirst',
							options: {
								cacheName: 'karte',
								expiration: { maxEntries: 4000, maxAgeSeconds: 60 * TAG },
								cacheableResponse: { statuses: [0, 200] }
							}
						}
					]
				},
				devOptions: { enabled: false }
			}
		)
	],
	worker: { format: 'es' },
	server: { host: true }
});
