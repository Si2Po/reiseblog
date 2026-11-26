// Aktionen zu einem Foto (Rechtsklick im Fotoalbum und in der Reise, Knöpfe in der Großansicht)
import Image from 'phosphor-svelte/lib/Image';
import MapPin from 'phosphor-svelte/lib/MapPin';
import Van from 'phosphor-svelte/lib/Van';
import ArrowsOut from 'phosphor-svelte/lib/ArrowsOut';
import Trash from 'phosphor-svelte/lib/Trash';
import Tray from 'phosphor-svelte/lib/Tray';
import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';
import { fotoDrehen } from './drehen.ts';
import { page } from '$app/state';
import { daten } from '#lib/db/daten.svelte.ts';
import { ui, zurReise, type Aktion } from '#lib/ui.svelte.ts';
import type { Foto, Ort } from '#lib/db/typen.ts';

/** Foto auf der Karte zeigen: Foto-Ebene an, am iPhone Blatt klein, damit die Karte den Platz bekommt */
export function fotoAufKarte(ort: Ort) {
	ui.fotosAn = true;
	if (!ui.breit) ui.hoehe = 'klein';
	ui.zeigeOrt(ort, 14);
}

export function fotoAktionen(f: Foto, ansehen: () => void): { titel: string; punkte: Aktion[] } {
	const reise = daten.reise(f.reise);
	const punkte: Aktion[] = [{ text: 'Ansehen', icon: ArrowsOut, los: ansehen }];
	if (f.ort) {
		const o = f.ort;
		punkte.push({ text: 'Auf der Karte', icon: MapPin, los: () => fotoAufKarte(o) });
	}
	if (reise && page.params.id !== reise.id) {
		punkte.push({ text: 'Zur Reise', icon: Van, los: () => zurReise(reise.id, f.eintrag) });
	}
	punkte.push({ text: 'Zuordnen …', icon: Tray, los: () => (ui.dialog = { art: 'zuordnen', fotos: [f.id] }) });
	punkte.push({ text: 'Drehen', icon: ArrowClockwise, los: () => fotoDrehen(f) });
	if (reise && reise.titelbild !== f.id) {
		punkte.push({
			text: 'Als Titelbild',
			icon: Image,
			los: async () => {
				await daten.speichern('reisen', { ...reise, titelbild: f.id });
				ui.zeige(`Titelbild von „${reise.titel}“`);
			}
		});
	}
	punkte.push({
		text: 'Löschen',
		icon: Trash,
		gefahr: true,
		los: async () => {
			const zurueck = await daten.loeschen('fotos', f.id);
			if (reise?.titelbild === f.id) await daten.speichern('reisen', { ...reise, titelbild: undefined });
			ui.zeige('Foto gelöscht', zurueck);
		}
	});
	return { titel: daten.eintrag(f.eintrag)?.titel ?? reise?.titel ?? 'Foto', punkte };
}
