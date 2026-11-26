/*
  Tastatur am PC: Tab springt von Gruppe zu Gruppe, die Pfeiltasten bewegen sich innerhalb der Gruppe
  („roving tabindex“). Pos1/Ende springen an den Anfang bzw. das Ende.
    {@attach pfeile('.ein-knopf')}            Liste (↑/↓)
    {@attach pfeile('a', 'zeile')}             Reihe (←/→)
    {@attach pfeile('.raster button', 'raster')} Raster (alle vier Richtungen, nach Lage auf dem Bildschirm)
  Nur ein Element der Gruppe ist per Tab erreichbar (das zuletzt benutzte), die anderen über die Pfeile.
*/
import type { Attachment } from 'svelte/attachments';

type Art = 'liste' | 'zeile' | 'raster';

const TASTEN: Record<Art, string[]> = {
	liste: ['ArrowUp', 'ArrowDown', 'Home', 'End'],
	zeile: ['ArrowLeft', 'ArrowRight', 'Home', 'End'],
	raster: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
};

export function pfeile(auswahl: string, art: Art = 'liste'): Attachment<HTMLElement> {
	return (box) => {
		let aktiv: HTMLElement | null = null;
		const elemente = () => [...box.querySelectorAll<HTMLElement>(auswahl)].filter((e) => e.offsetParent !== null && !(e as HTMLButtonElement).disabled);

		/** nur das aktive Element bekommt tabindex 0 */
		function ordnen() {
			const alle = elemente();
			if (!alle.length) return;
			if (!aktiv || !alle.includes(aktiv)) aktiv = alle[0];
			for (const e of alle) e.tabIndex = e === aktiv ? 0 : -1;
		}

		function naechstes(von: HTMLElement, taste: string, alle: HTMLElement[]): HTMLElement | undefined {
			const i = alle.indexOf(von);
			if (taste === 'Home') return alle[0];
			if (taste === 'End') return alle.at(-1);
			if (art !== 'raster') return alle[i + (taste === 'ArrowDown' || taste === 'ArrowRight' ? 1 : -1)];
			if (taste === 'ArrowRight') return alle[i + 1];
			if (taste === 'ArrowLeft') return alle[i - 1];
			// hoch/runter: in der nächsten Zeile das Element, das waagerecht am nächsten liegt
			const a = von.getBoundingClientRect();
			const mitte = a.left + a.width / 2;
			const runter = taste === 'ArrowDown';
			const kandidaten = alle.filter((e) => {
				const r = e.getBoundingClientRect();
				return runter ? r.top > a.top + 4 : r.top < a.top - 4;
			});
			if (!kandidaten.length) return undefined;
			const zeile = runter
				? Math.min(...kandidaten.map((e) => e.getBoundingClientRect().top))
				: Math.max(...kandidaten.map((e) => e.getBoundingClientRect().top));
			return kandidaten
				.filter((e) => Math.abs(e.getBoundingClientRect().top - zeile) < 4)
				.reduce((b, e) => {
					const r = e.getBoundingClientRect(),
						rb = b.getBoundingClientRect();
					return Math.abs(r.left + r.width / 2 - mitte) < Math.abs(rb.left + rb.width / 2 - mitte) ? e : b;
				});
		}

		function taste(e: KeyboardEvent) {
			if (!TASTEN[art].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
			// in Eingabefeldern bleiben die Pfeile beim Text
			if ((e.target as HTMLElement).closest('input, textarea, select')) return;
			const alle = elemente();
			const von = alle.find((x) => x === document.activeElement || x.contains(document.activeElement));
			if (!von) return;
			const ziel = naechstes(von, e.key, alle);
			if (!ziel) return;
			e.preventDefault();
			aktiv = ziel;
			ordnen();
			ziel.focus();
			ziel.scrollIntoView({ block: 'nearest' });
		}

		function fokus(e: FocusEvent) {
			const t = (e.target as HTMLElement).closest<HTMLElement>(auswahl);
			if (t && box.contains(t) && t !== aktiv) {
				aktiv = t;
				ordnen();
			}
		}

		ordnen();
		// Liste ändert sich (neue Einträge, Filter) → Tab-Reihenfolge nachziehen
		const beobachter = new MutationObserver(() => ordnen());
		beobachter.observe(box, { childList: true, subtree: true });
		box.addEventListener('keydown', taste);
		box.addEventListener('focusin', fokus);
		return () => {
			beobachter.disconnect();
			box.removeEventListener('keydown', taste);
			box.removeEventListener('focusin', fokus);
		};
	};
}
