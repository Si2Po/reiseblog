/*
  Foto um 90° im Uhrzeigersinn drehen: Bild in voller Größe und Vorschau werden neu gezeichnet.
  Das volle Bild wird danach neu hochgeladen (pfad leer → der Abgleich lädt es verschlüsselt hoch);
  andere Geräte merken an der neuen Vorschau, dass sie ihr gespeichertes Bild neu holen müssen
  (siehe abgleich.svelte.ts, #holen).
*/
import { db } from '#lib/db/db.ts';
import { daten } from '#lib/db/daten.svelte.ts';
import { abgleich } from '#lib/db/abgleich.svelte.ts';
import { vergessen } from './bild.ts';
import type { Foto } from '#lib/db/typen.ts';

async function gedreht(quelle: string, qualitaet: number): Promise<Blob> {
	const bild = new Image();
	bild.src = quelle;
	await bild.decode();
	const b = bild.naturalWidth,
		h = bild.naturalHeight;
	const c = document.createElement('canvas');
	c.width = h;
	c.height = b;
	const g = c.getContext('2d')!;
	g.translate(h, 0);
	g.rotate(Math.PI / 2);
	g.drawImage(bild, 0, 0, b, h);
	return new Promise((ok, fehler) => c.toBlob((x) => (x ? ok(x) : fehler(new Error('Drehen ging nicht.'))), 'image/jpeg', qualitaet));
}

const alsUrl = (blob: Blob) =>
	new Promise<string>((ok) => {
		const r = new FileReader();
		r.onload = () => ok(r.result as string);
		r.readAsDataURL(blob);
	});

export async function fotoDrehen(f: Foto) {
	const voll = (await db.dateien.get(f.id))?.bild ?? (await abgleich.fotoLaden(f).catch(() => null));
	// Liegt das Bild nur auf dem Server und ist gerade nicht erreichbar: lieber gar nicht drehen als nur die Vorschau
	if (!voll && f.pfad) throw new Error('Das Foto ist gerade nicht verfügbar – bitte mit Internet nochmal versuchen.');

	if (voll) {
		const url = URL.createObjectURL(new Blob([voll], { type: 'image/jpeg' }));
		try {
			const neu = await gedreht(url, 0.82);
			await db.dateien.put({ id: f.id, bild: await neu.arrayBuffer(), typ: 'image/jpeg' });
		} finally {
			URL.revokeObjectURL(url);
		}
	}
	const vorschau = await alsUrl(await gedreht(f.vorschau, 0.72));
	vergessen(f.id);
	await daten.speichern('fotos', { ...f, vorschau, breite: f.hoehe, hoehe: f.breite, pfad: voll ? undefined : f.pfad });
}
