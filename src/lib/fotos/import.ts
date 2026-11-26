/*
  Fotos hinzufügen:
  1. Aufnahmeort und -zeit aus den EXIF-Daten lesen (vor dem Verkleinern, das Canvas entfernt sie)
  2. auf max. 1600 px verkleinern (JPEG, ca. 300 KB) + Vorschaubild 320 px
  3. Reise und Eintrag zuordnen (vorgegeben oder nach Datum; mit GPS landen Fotos beim passenden Ausflug)
  4. Bild lokal speichern (IndexedDB), Hochladen übernimmt später der Abgleich
*/
import exifr from 'exifr';
import { format } from 'date-fns';
import { db } from '#lib/db/db.ts';
import { daten } from '#lib/db/daten.svelte.ts';
import { ui } from '#lib/ui.svelte.ts';
import { reiseBis, eintraegeVon } from '#lib/auswertung.ts';
import { abstand } from '#lib/geo.ts';
import { plusTage } from '#lib/datum.ts';
import type { Eintrag, Foto, Ort } from '#lib/db/typen.ts';

const GROSS = 1600;
const KLEIN = 320;

interface Ziel {
	reise?: string;
	eintrag?: string;
}

/** Öffnet die Fotoauswahl (iPhone: Mediathek oder Kamera) */
export function fotosWaehlen(ziel: Ziel = {}) {
	// Das Feld muss im Dokument hängen – sonst meldet iOS die Auswahl manchmal nicht zurück
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = 'image/*';
	input.multiple = true;
	input.style.cssText = 'position:fixed;left:-1000px;top:0;opacity:0';
	document.body.append(input);
	const weg = () => setTimeout(() => input.remove(), 1000);
	input.addEventListener('change', () => {
		if (input.files?.length) fotosHinzufuegen([...input.files], ziel);
		weg();
	});
	input.addEventListener('cancel', weg);
	input.click();
}

/** Für Drag & Drop am PC und die Auswahl oben */
export async function fotosHinzufuegen(dateien: File[], ziel: Ziel = {}) {
	const bilder = dateien.filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
	if (!bilder.length) return;
	let ok = 0,
		ohneOrt = 0,
		ohneReise = 0,
		ausserhalb = 0;
	const einsortiert = new Map<string, number>();
	for (const [i, datei] of bilder.entries()) {
		ui.zeige(bilder.length === 1 ? 'Foto wird hinzugefügt …' : `Foto ${i + 1} von ${bilder.length} …`);
		try {
			const f = await einFoto(datei, ziel);
			ok++;
			if (!f.ort) ohneOrt++;
			if (f.eintrag && !ziel.eintrag) einsortiert.set(f.eintrag, (einsortiert.get(f.eintrag) ?? 0) + 1);
			if (!f.reise) ohneReise++;
			else if (!f.eintrag && ausserhalbDerReise(f)) ausserhalb++;
		} catch (e) {
			console.error('Foto ging nicht:', datei.name, (e as Error)?.name, (e as Error)?.message);
		}
	}
	const eintrag = daten.eintrag(ziel.eintrag);
	const fotos = ok === 1 ? '1 Foto' : `${ok} Fotos`;
	const teile = [eintrag ? `${fotos} zu „${eintrag.titel}“ hinzugefügt` : `${fotos} hinzugefügt`];
	if (einsortiert.size === 1) {
		const [[eid, n]] = [...einsortiert];
		teile.push(`${n === ok ? (n === 1 ? 'passt' : 'alle passen') : n} zu „${daten.eintrag(eid)?.titel}“`);
	} else if (einsortiert.size) teile.push(`${[...einsortiert.values()].reduce((a, b) => a + b)} bei ${einsortiert.size} Ausflügen einsortiert`);
	if (ok < bilder.length) teile.push(`${bilder.length - ok} ließen sich nicht lesen`);
	if (ohneReise) teile.push(`${ohneReise} ohne Reise – auf der Karte und im Fotoalbum`);
	else if (ausserhalb) teile.push(`${ausserhalb} außerhalb des Reisezeitraums – unter „Weitere Fotos“`);
	else if (ohneOrt && !eintrag) teile.push(`${ohneOrt} ohne Ort – in der Fotoauswahl unter „Optionen“ den Standort einschalten`);
	ui.zeige(teile.join(' · '));
}

function ausserhalbDerReise(f: Foto): boolean {
	const r = daten.reise(f.reise);
	const d = f.aufgenommen.slice(0, 10);
	return !!r && (d < r.start || d > reiseBis(r));
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
	let ort: Ort | undefined = gps && Number.isFinite(gps.latitude) ? { lat: gps.latitude, lng: gps.longitude } : undefined;
	const reise = ziel.reise ?? daten.eintrag(ziel.eintrag)?.reise ?? reiseAm(tag);
	const eintrag = daten.eintrag(ziel.eintrag) ?? (reise && ort ? ausflugBeiFoto(reise, tag, ort) : undefined);
	if (!ort) ort = ortOhneGps(eintrag, reise, tag);

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

/**
 * Ausflug, zu dem ein Foto passt: am selben Tag, höchstens 15 km entfernt und näher am Ausflug
 * als an der Übernachtung (Fotos am Stellplatz bleiben beim Tag).
 */
export function ausflugBeiFoto(reise: string, tag: string, ort: Ort): Eintrag | undefined {
	const liste = eintraegeVon(reise);
	let bester: Eintrag | undefined;
	let weite = 15000;
	for (const e of liste) {
		if (e.typ !== 'outing' || e.datum !== tag || !e.ort) continue;
		const m = abstand(ort, e.ort);
		if (m < weite) [bester, weite] = [e, m];
	}
	if (!bester) return undefined;
	// Übernachtungen rund um diesen Tag (Nacht davor und Nacht danach)
	const naeherAmPlatz = liste.some(
		(e) => e.typ === 'stay' && e.ort && e.datum <= tag && plusTage(e.datum, e.naechte ?? 1) >= tag && abstand(ort, e.ort) < weite
	);
	return naeherAmPlatz ? undefined : bester;
}

/** Reise, in deren Zeitraum das Datum fällt */
function reiseAm(tag: string): string | undefined {
	return daten.reisen.find((r) => r.start <= tag && reiseBis(r) >= tag)?.id;
}

/**
 * Ort für ein Foto ohne GPS:
 * - beim Eintrag: dessen Ort (Fahrt: Mitte der Strecke)
 * - sonst bei der Reise: Ort des Tages (Übernachtung bzw. letzte davor), sonst die Mitte der Reise
 * Ohne Reise bleibt das Foto ohne Ort (lässt sich im Fotoalbum auf der Karte platzieren).
 */
export function ortOhneGps(eintrag: Eintrag | undefined, reise: string | undefined, tag: string): Ort | undefined {
	const o = eintrag && eintragOrt(eintrag);
	if (o) return o;
	return reise ? (ortAmTag(reise, tag) ?? reiseMitte(reise)) : undefined;
}

/** Ort eines Eintrags; bei Fahrten der Punkt auf halber Strecke */
function eintragOrt(e: Eintrag): Ort | undefined {
	if (e.ort) return e.ort;
	if (e.typ !== 'drive') return undefined;
	const linie = e.route?.length ? e.route : [e.von, ...(e.via ?? []), e.nach].filter((x): x is Ort => !!x).map((x): [number, number] => [x.lng, x.lat]);
	if (!linie.length) return undefined;
	const pkt = (i: number) => ({ lng: linie[i][0], lat: linie[i][1] });
	let gesamt = 0;
	for (let i = 1; i < linie.length; i++) gesamt += abstand(pkt(i - 1), pkt(i));
	let weg = 0;
	for (let i = 1; i < linie.length; i++) {
		const stueck = abstand(pkt(i - 1), pkt(i));
		if (weg + stueck >= gesamt / 2) {
			const t = stueck ? (gesamt / 2 - weg) / stueck : 0;
			return { lat: linie[i - 1][1] + (linie[i][1] - linie[i - 1][1]) * t, lng: linie[i - 1][0] + (linie[i][0] - linie[i - 1][0]) * t };
		}
		weg += stueck;
	}
	return pkt(0);
}

/** Mitte der Reise: der Ort der Reise, der am nächsten an der Mitte aller Orte liegt (nicht irgendwo im Meer) */
function reiseMitte(reise: string): Ort | undefined {
	const orte = eintraegeVon(reise)
		.map(eintragOrt)
		.filter((x): x is Ort => !!x);
	if (!orte.length) return undefined;
	const lat = orte.reduce((a, o) => a + o.lat, 0) / orte.length;
	const lng = orte.reduce((a, o) => a + o.lng, 0) / orte.length;
	const nah = orte.reduce((a, o) => (abstand(o, { lat, lng }) < abstand(a, { lat, lng }) ? o : a));
	return { lat: nah.lat, lng: nah.lng };
}

/** Einmal beim Start: Fotos in Reisen, die noch keinen Ort haben, nach denselben Regeln einordnen */
export async function fotoOrteNachtragen() {
	for (const f of daten.fotos) {
		if (f.ort || !f.reise) continue;
		const ort = ortOhneGps(daten.eintrag(f.eintrag), f.reise, f.aufgenommen.slice(0, 10));
		if (ort) await daten.speichern('fotos', { ...f, ort });
	}
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
