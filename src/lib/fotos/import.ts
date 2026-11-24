/*
  Fotos hinzufügen:
  1. Aufnahmeort und -zeit aus den EXIF-Daten lesen (vor dem Verkleinern, das Canvas entfernt sie)
  2. auf max. 1600 px verkleinern (JPEG, ca. 300 KB) + Vorschaubild 320 px
  3. Reise und Eintrag zuordnen (vorgegeben oder nach Datum)
  4. Bild lokal speichern (IndexedDB), Hochladen übernimmt später der Abgleich
*/
import exifr from 'exifr';
import { format } from 'date-fns';
import { db } from '#lib/db/db.ts';
import { daten } from '#lib/db/daten.svelte.ts';
import { ui } from '#lib/ui.svelte.ts';
import { reiseEnde, eintraegeVon } from '#lib/auswertung.ts';
import type { Foto, Ort } from '#lib/db/typen.ts';

const GROSS = 1600;
const KLEIN = 320;

interface Ziel {
	reise?: string;
	eintrag?: string;
}

/** Öffnet die Fotoauswahl (iPhone: Mediathek oder Kamera) */
export function fotosWaehlen(ziel: Ziel = {}) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = 'image/*';
	input.multiple = true;
	input.onchange = () => {
		if (input.files?.length) fotosHinzufuegen([...input.files], ziel);
	};
	input.click();
}

/** Für Drag & Drop am PC und die Auswahl oben */
export async function fotosHinzufuegen(dateien: File[], ziel: Ziel = {}) {
	const bilder = dateien.filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
	if (!bilder.length) return;
	ui.zeige(bilder.length === 1 ? 'Foto wird hinzugefügt …' : `${bilder.length} Fotos werden hinzugefügt …`);
	let ok = 0,
		ohneOrt = 0,
		ohneReise = 0;
	for (const datei of bilder) {
		try {
			const f = await einFoto(datei, ziel);
			ok++;
			if (!f.ort) ohneOrt++;
			if (!f.reise) ohneReise++;
		} catch (e) {
			console.error('Foto ging nicht:', datei.name, (e as Error)?.name, (e as Error)?.message);
		}
	}
	const teile = [ok === 1 ? '1 Foto hinzugefügt' : `${ok} Fotos hinzugefügt`];
	if (ok < bilder.length) teile.push(`${bilder.length - ok} ließen sich nicht lesen`);
	if (ohneReise) teile.push(`${ohneReise} passen zu keiner Reise`);
	else if (ohneOrt) teile.push(`${ohneOrt} ohne Ort – in der Fotoauswahl unter „Optionen“ den Standort einschalten`);
	ui.zeige(teile.join(' · '));
}

async function einFoto(datei: File, ziel: Ziel): Promise<Foto> {
	const [gps, meta] = await Promise.all([
		exifr.gps(datei).catch(() => null),
		exifr.parse(datei, ['DateTimeOriginal', 'CreateDate']).catch(() => null)
	]);
	const zeit: Date = meta?.DateTimeOriginal ?? meta?.CreateDate ?? new Date(datei.lastModified || Date.now());
	const aufgenommen = format(zeit, "yyyy-MM-dd'T'HH:mm:ss");
	const tag = aufgenommen.slice(0, 10);

	const bitmap = await createImageBitmap(datei, { imageOrientation: 'from-image' });
	const bild = await verkleinern(bitmap, GROSS, 0.82, 'blob');
	const vorschau = await verkleinern(bitmap, KLEIN, 0.72, 'url', true);
	const breite = bitmap.width,
		hoehe = bitmap.height;
	bitmap.close();

	// Zuordnung
	const eintrag = daten.eintrag(ziel.eintrag);
	const reise = ziel.reise ?? eintrag?.reise ?? reiseAm(tag);
	let ort: Ort | undefined = gps && Number.isFinite(gps.latitude) ? { lat: gps.latitude, lng: gps.longitude } : undefined;
	if (!ort) ort = eintrag?.ort ?? (reise ? ortAmTag(reise, tag) : undefined);

	const id = crypto.randomUUID();
	await db.dateien.put({ id, bild: await (bild as Blob).arrayBuffer(), typ: 'image/jpeg' });
	return daten.speichern('fotos', {
		id,
		reise,
		eintrag: eintrag?.id,
		ort,
		aufgenommen,
		breite,
		hoehe,
		vorschau: vorschau as string
	});
}

/** Reise, in deren Zeitraum das Datum fällt */
function reiseAm(tag: string): string | undefined {
	return daten.reisen.find((r) => r.start <= tag && reiseEnde(r) >= tag)?.id;
}

/** Ort eines Eintrags am selben Tag (sonst die letzte Übernachtung davor) */
function ortAmTag(reise: string, tag: string): Ort | undefined {
	const liste = eintraegeVon(reise).filter((e) => e.ort);
	return liste.find((e) => e.datum === tag)?.ort ?? liste.filter((e) => e.datum <= tag).at(-1)?.ort;
}

async function verkleinern(b: ImageBitmap, max: number, qualitaet: number, als: 'blob' | 'url', quadratisch = false) {
	let w = b.width,
		h = b.height,
		sx = 0,
		sy = 0,
		sw = w,
		sh = h;
	if (quadratisch) {
		// Vorschau: mittiger Ausschnitt, damit runde/quadratische Kacheln gut aussehen
		const s = Math.min(w, h);
		sx = (w - s) / 2;
		sy = (h - s) / 2;
		sw = sh = s;
		w = h = Math.min(max, s);
	} else {
		const f = Math.min(1, max / Math.max(w, h));
		w = Math.round(w * f);
		h = Math.round(h * f);
	}
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d')!;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(b, sx, sy, sw, sh, 0, 0, w, h);
	if (als === 'url') return c.toDataURL('image/jpeg', qualitaet);
	return new Promise<Blob>((ok, fehler) => c.toBlob((x) => (x ? ok(x) : fehler(new Error('toBlob'))), 'image/jpeg', qualitaet));
}
