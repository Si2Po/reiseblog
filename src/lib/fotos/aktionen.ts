// Aktionen zu einem Foto (Rechtsklick im Fotoalbum und in der Reise)
import Image from 'phosphor-svelte/lib/Image';
import MapPin from 'phosphor-svelte/lib/MapPin';
import Van from 'phosphor-svelte/lib/Van';
import ArrowsOut from 'phosphor-svelte/lib/ArrowsOut';
import Trash from 'phosphor-svelte/lib/Trash';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { daten } from '#lib/db/daten.svelte.ts';
import { ui, type Aktion } from '#lib/ui.svelte.ts';
import type { Foto } from '#lib/db/typen.ts';

export function fotoAktionen(f: Foto, ansehen: () => void): { titel: string; punkte: Aktion[] } {
	const reise = daten.reise(f.reise);
	const punkte: Aktion[] = [{ text: 'Ansehen', icon: ArrowsOut, los: ansehen }];
	if (f.ort) {
		const o = f.ort;
		punkte.push({
			text: 'Auf der Karte',
			icon: MapPin,
			los: () => {
				ui.fotosAn = true;
				if (!ui.breit) ui.hoehe = 'klein';
				ui.zeigeOrt(o, 14);
			}
		});
	}
	if (reise && page.params.id !== reise.id) {
		punkte.push({
			text: 'Zur Reise',
			icon: Van,
			los: () => {
				ui.markiert = f.eintrag ?? null;
				goto(`#/reise/${reise.id}`);
			}
		});
	}
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
