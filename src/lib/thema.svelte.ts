// Hell/Dunkel: „auto“ folgt dem Gerät. Die Wahl liegt in localStorage (gerätebezogen, wird nicht abgeglichen).
export type ThemaWahl = 'auto' | 'hell' | 'dunkel';

const SCHLUESSEL = 'reiseblog-thema';
const frage = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

class Thema {
	wahl = $state<ThemaWahl>((localStorage.getItem(SCHLUESSEL) as ThemaWahl) || 'auto');
	#system = $state(frage?.matches ?? false);
	dunkel = $derived(this.wahl === 'auto' ? this.#system : this.wahl === 'dunkel');

	constructor() {
		frage?.addEventListener('change', (e) => (this.#system = e.matches));
	}

	setzen(w: ThemaWahl) {
		this.wahl = w;
		if (w === 'auto') localStorage.removeItem(SCHLUESSEL);
		else localStorage.setItem(SCHLUESSEL, w);
	}

	/** Am <html> setzen (CSS-Variablen) und Statusleisten-Farbe anpassen. */
	anwenden() {
		document.documentElement.dataset.thema = this.dunkel ? 'dunkel' : 'hell';
		const farbe = this.dunkel ? '#111111' : '#f6f6f2';
		let meta = document.querySelector('meta[name="theme-color"]');
		if (!meta) {
			meta = document.createElement('meta');
			meta.setAttribute('name', 'theme-color');
			document.head.append(meta);
		}
		meta.setAttribute('content', farbe);
	}
}

export const thema = new Thema();
