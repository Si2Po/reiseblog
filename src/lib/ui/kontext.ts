// Rechtsklick-Menü (PC) für beliebige Elemente: {@attach kontext(() => ({ titel, punkte }))}
// Öffnet das Aktionen-Menü (ui.aktionen) an der Mausposition. Die Punkte werden erst beim Klick
// berechnet, damit sie zum aktuellen Stand passen.
import type { Attachment } from 'svelte/attachments';
import { ui, type Aktion } from '#lib/ui.svelte.ts';

/**
 * Wo das Menü aufgeht: an der Maus – oder bei Kontextmenü-Taste bzw. Umschalt+F10 (keine
 * Mausposition, clientX/Y = 0) im Element: `links` px vom linken Rand, `oben` px vom oberen Rand
 * (ohne Angabe auf halber Höhe).
 */
export function menuePosition(e: MouseEvent, el: Element, links = 16, oben?: number): { x: number; y: number } {
	if (e.clientX !== 0 || e.clientY !== 0) return { x: e.clientX, y: e.clientY };
	const r = el.getBoundingClientRect();
	return { x: r.left + links, y: r.top + (oben ?? r.height / 2) };
}

export function kontext(menue: () => { titel?: string; punkte: Aktion[] }): Attachment<HTMLElement> {
	return (el) => {
		const oeffnen = (e: MouseEvent) => {
			const m = menue();
			if (!m.punkte.length) return;
			e.preventDefault();
			e.stopPropagation();
			ui.aktionen = { ...m, ...menuePosition(e, el) };
		};
		el.addEventListener('contextmenu', oeffnen);
		return () => el.removeEventListener('contextmenu', oeffnen);
	};
}
