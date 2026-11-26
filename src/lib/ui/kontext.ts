// Rechtsklick-Menü (PC) für beliebige Elemente: {@attach kontext(() => ({ titel, punkte }))}
// Öffnet das Aktionen-Menü (ui.aktionen) an der Mausposition. Die Punkte werden erst beim Klick
// berechnet, damit sie zum aktuellen Stand passen.
import type { Attachment } from 'svelte/attachments';
import { ui, type Aktion } from '#lib/ui.svelte.ts';

export function kontext(menue: () => { titel?: string; punkte: Aktion[] }): Attachment<HTMLElement> {
	return (el) => {
		const oeffnen = (e: MouseEvent) => {
			const m = menue();
			if (!m.punkte.length) return;
			e.preventDefault();
			e.stopPropagation();
			// Kontextmenü-Taste bzw. Umschalt+F10: keine Mausposition → am Element öffnen
			const r = el.getBoundingClientRect();
			const ohneMaus = e.clientX === 0 && e.clientY === 0;
			ui.aktionen = { ...m, x: ohneMaus ? r.left + 16 : e.clientX, y: ohneMaus ? r.top + r.height / 2 : e.clientY };
		};
		el.addEventListener('contextmenu', oeffnen);
		return () => el.removeEventListener('contextmenu', oeffnen);
	};
}
