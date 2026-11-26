/*
  Eine Reise als PDF zum Weitergeben (A4 hoch, mit jsPDF – wird erst beim Export geladen).
  Warum keine Druckansicht: window.print() geht in der Home-Bildschirm-App auf dem iPhone nicht
  verlässlich. Eine echte Datei lässt sich dagegen über das Teilen-Menü verschicken oder sichern.

  Aufbau: Titel, Kennzahlen, Titelbild, Karte mit Route (ohne Internet: Skizze nur aus den Linien
  der Reise, siehe karte.ts), dann Tag für Tag die Einträge wie in der Zeitleiste, am Ende die Kosten.
  Was hinein kommt, wählt man vorher: Fotos, Texte/Notizen, Kosten (Standard: aus).
  Schrift: Helvetica (in jedem PDF-Leser eingebaut, kann nur Zeichen aus „WinAnsi“ – deshalb `t()`).
*/
import type { jsPDF as JsPdf } from 'jspdf';
import { daten } from '#lib/db/daten.svelte.ts';
import { tage, naechte, km, plaetzeAnzahl, fotosVon, fotosVonEintrag, reiseEnde, nachtNotizen, weitereFotos, eintraegeVon } from '#lib/auswertung.ts';
import { zeitraum, tagLang, monatJahr, reiseTag, dauer, zahl, preisText, notizZeit, wort } from '#lib/datum.ts';
import { reiseKosten, summe, nurEuro, wechselkurse, kostenName, type Betraege } from '#lib/kosten.svelte.ts';
import { wetterArt, tagesWetter } from '#lib/wetter.ts';
import { reiseFarbe } from '#lib/farben.ts';
import { vollbild } from '#lib/fotos/bild.ts';
import { kartenBild, KARTE_QUELLE } from './karte.ts';
import { type Eintrag, type Foto, type LngLat, type Notiz, type Reise } from '#lib/db/typen.ts';

export interface PdfWahl {
	fotos: boolean;
	texte: boolean;
	kosten: boolean;
}

// --- Maße in mm (A4) und Farben ---
const BREITE = 210;
const HOEHE = 297;
const RAND = 18;
const INNEN = BREITE - 2 * RAND;
const UNTEN = HOEHE - 16;
const TEXT = '#18211b';
const GRAU = '#5d6660';
const LINIE = '#d6d9d1';
const PAPIER = '#f3f4f0';
const PT = 0.3528; // 1 pt in mm

const TYP_NAME = { stay: 'Übernachtung', drive: 'Fahrt', outing: 'Ausflug' } as const;

/** Nur Zeichen, die Helvetica im PDF kann (WinAnsi); Pfeile und Emojis werden ersetzt bzw. weggelassen */
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function t(s: string): string {
	return s
		.replace(/\s*→\s*/g, ' – ')
		.replace(/≈\s*/g, 'ca. ')
		.replace(/[  ]/g, ' ')
		.replace(/[^\u0000-ÿ]/g, (z) => (WIN_ANSI_EXTRA.includes(z) ? z : ''))
		.replace(/[\u0080-\u009f]/g, '');
}

/** Foto als JPEG im Seitenverhältnis b:h zuschneiden (Mitte, wie object-fit: cover) */
async function bildZuschnitt(f: Foto, b: number, h: number): Promise<string | null> {
	try {
		// <img> statt createImageBitmap: Safari kann so auch SVG (Beispielfotos, ohne eigene Größe)
		const bild = new Image();
		bild.src = await vollbild(f);
		await bild.decode();
		const bw = bild.naturalWidth || f.breite || b;
		const bh = bild.naturalHeight || f.hoehe || h;
		const mass = Math.max(b / bw, h / bh);
		const c = document.createElement('canvas');
		c.width = b;
		c.height = h;
		c.getContext('2d')!.drawImage(bild, (b - bw * mass) / 2, (h - bh * mass) / 2, bw * mass, bh * mass);
		return c.toDataURL('image/jpeg', 0.82);
	} catch {
		return null;
	}
}

/** Linien und Punkte der Reise für die Routenskizze */
function skizzeDaten(reise: string) {
	const linien: LngLat[][] = [];
	const naechtePunkte: LngLat[] = [];
	const ausfluege: LngLat[] = [];
	for (const e of eintraegeVon(reise)) {
		if (e.typ === 'drive') {
			if (e.route?.length) linien.push(e.route);
			else if (e.von && e.nach) linien.push([[e.von.lng, e.von.lat], ...(e.via ?? []).map((o): LngLat => [o.lng, o.lat]), [e.nach.lng, e.nach.lat]]);
		} else if (e.ort) (e.typ === 'stay' ? naechtePunkte : ausfluege).push([e.ort.lng, e.ort.lat]);
	}
	return { linien, naechtePunkte, ausfluege };
}

class Bau {
	y = RAND;
	constructor(
		public doc: JsPdf,
		public farbe: string
	) {}

	neueSeite() {
		this.doc.addPage();
		this.y = RAND;
	}
	/** Platz für h mm sicherstellen, sonst neue Seite */
	platz(h: number) {
		if (this.y + h > UNTEN) this.neueSeite();
	}
	schrift(groesse: number, art: 'normal' | 'bold' | 'italic' = 'normal', farbe = TEXT) {
		this.doc.setFont('helvetica', art);
		this.doc.setFontSize(groesse);
		this.doc.setTextColor(farbe);
	}
	zeilenHoehe = (groesse: number) => groesse * PT * 1.35;

	/** Absatz mit Umbruch; bricht auch über Seiten hinweg */
	absatz(text: string, groesse: number, art: 'normal' | 'bold' | 'italic' = 'normal', farbe = TEXT, x = RAND, breite = INNEN) {
		this.schrift(groesse, art, farbe);
		const lh = this.zeilenHoehe(groesse);
		for (const zeile of this.doc.splitTextToSize(t(text), breite) as string[]) {
			this.platz(lh);
			this.doc.text(zeile, x, this.y + groesse * PT);
			this.y += lh;
		}
	}
}

/** Erstellt das PDF. `fortschritt` meldet geladene Fotos. */
export async function reisePdf(r: Reise, wahl: PdfWahl, fortschritt?: (n: number, von: number, text?: string) => void): Promise<File> {
	const { jsPDF } = await import('jspdf');
	const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
	doc.setProperties({ title: t(r.titel), creator: 'Reiseblog' });
	const farbe = reiseFarbe(r.farbe, false);
	const b = new Bau(doc, farbe);
	const liste = tage(r.id);

	const alleFotos = wahl.fotos ? fotosVon(r.id) : [];
	let geladen = 0;
	const foto = async (f: Foto, pb: number, ph: number) => {
		const bild = await bildZuschnitt(f, pb, ph);
		fortschritt?.(++geladen, alleFotos.length);
		return bild;
	};

	// --- Kopf ---
	b.schrift(9, 'bold', farbe);
	doc.setCharSpace(0.6);
	doc.text(t(`REISETAGEBUCH · ${monatJahr(r.start).toUpperCase()}`), RAND, b.y + 9 * PT);
	doc.setCharSpace(0);
	b.y += 7;
	b.absatz(r.titel, 30, 'bold');
	b.y += 1;
	b.absatz(zeitraum(r.start, r.ende ?? reiseEnde(r)), 12, 'normal', GRAU);
	b.y += 6;

	// Kennzahlen
	const zahlen: [string, string][] = [
		[String(naechte(r.id)), wort(naechte(r.id), 'Nacht', 'Nächte')],
		[zahl(km(r.id)), 'km'],
		[String(plaetzeAnzahl(r.id)), wort(plaetzeAnzahl(r.id), 'Platz', 'Plätze')],
		[String(fotosVon(r.id).length), wort(fotosVon(r.id).length, 'Foto', 'Fotos')]
	];
	const zb = (INNEN - 3 * 4) / 4;
	zahlen.forEach(([w, name], i) => {
		const x = RAND + i * (zb + 4);
		doc.setFillColor(i === 0 ? farbe : PAPIER);
		doc.roundedRect(x, b.y, zb, 17, 2, 2, 'F');
		b.schrift(16, 'bold', i === 0 ? '#ffffff' : TEXT);
		doc.text(t(w), x + 4, b.y + 8);
		b.schrift(9, 'normal', i === 0 ? '#ffffff' : GRAU);
		doc.text(t(name), x + 4, b.y + 13.5);
	});
	b.y += 17 + 8;

	// Titelbild
	const titel = wahl.fotos ? (daten.foto(r.titelbild) ?? alleFotos[0]) : undefined;
	if (titel) {
		const h = INNEN * 0.56;
		const bild = await bildZuschnitt(titel, 1500, Math.round(1500 * 0.56));
		if (bild) {
			doc.addImage(bild, 'JPEG', RAND, b.y, INNEN, h, undefined, 'FAST');
			b.y += h + 8;
		}
	}

	// Karte (mit Internet) bzw. Routenskizze auf Papiergrund (ohne)
	const sk = skizzeDaten(r.id);
	const punkte = [...sk.linien.flat(), ...sk.naechtePunkte, ...sk.ausfluege];
	if (punkte.length) {
		const merc = ([lng, lat]: LngLat): [number, number] => [lng, -Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI)];
		const p = punkte.map(merc);
		const minX = Math.min(...p.map((q) => q[0])),
			maxX = Math.max(...p.map((q) => q[0])),
			minY = Math.min(...p.map((q) => q[1])),
			maxY = Math.max(...p.map((q) => q[1]));
		const spanX = Math.max(maxX - minX, 0.01),
			spanY = Math.max(maxY - minY, 0.01);
		const innen = 8;
		// so hoch wie die Reise es braucht, aber möglichst noch auf die erste Seite
		const rest = UNTEN - b.y - 8;
		const h = Math.min(Math.max((INNEN - 2 * innen) * (spanY / spanX) + 2 * innen, 70), rest >= 60 ? Math.min(rest, 115) : 115);
		b.platz(h + 8);
		const oben = b.y;

		fortschritt?.(0, 0, 'Karte wird geladen …');
		// 720 px Breite: Ortsnamen erscheinen im Druck gut lesbar (etwa 8 pt)
		const karte = await kartenBild(punkte, 720, Math.round((720 * h) / INNEN));
		let xy: (q: LngLat) => [number, number];
		if (karte) {
			doc.addImage(karte.bild, 'JPEG', RAND, oben, INNEN, h, undefined, 'FAST');
			xy = (q) => {
				const [x, y] = karte.xy(q);
				return [RAND + x * INNEN, oben + y * h];
			};
		} else {
			const m = Math.min((INNEN - 2 * innen) / spanX, (h - 2 * innen) / spanY);
			const ox = RAND + (INNEN - spanX * m) / 2,
				oy = oben + (h - spanY * m) / 2;
			xy = (q) => {
				const [x, y] = merc(q);
				return [ox + (x - minX) * m, oy + (y - minY) * m];
			};
			doc.setFillColor(PAPIER);
			doc.roundedRect(RAND, oben, INNEN, h, 2, 2, 'F');
		}
		doc.setLineJoin('round');
		doc.setLineCap('round');
		// Route: auf der Karte mit hellem Rand, damit sie sich vom Hintergrund abhebt
		const strecke = (breite: number, farbeLinie: string) => {
			doc.setDrawColor(farbeLinie);
			doc.setLineWidth(breite);
			for (const l of sk.linien) {
				const q = l.map(xy);
				for (let i = 1; i < q.length; i++) doc.line(q[i - 1][0], q[i - 1][1], q[i][0], q[i][1]);
			}
		};
		if (karte) strecke(1.5, '#ffffff');
		strecke(0.75, farbe);
		doc.setLineWidth(0.4);
		doc.setDrawColor(farbe);
		for (const a of sk.ausfluege) {
			const [x, y] = xy(a);
			doc.setFillColor('#ffffff');
			doc.circle(x, y, 0.9, 'FD');
		}
		for (const n of sk.naechtePunkte) {
			const [x, y] = xy(n);
			doc.setFillColor('#ffffff');
			doc.circle(x, y, 1.8, 'F');
			doc.setFillColor(farbe);
			doc.circle(x, y, 1.25, 'F');
		}
		karte?.weg();
		b.y = oben + h;
		if (karte) {
			b.schrift(6.5, 'normal', GRAU);
			doc.text(t(KARTE_QUELLE), RAND + INNEN, b.y + 3.2, { align: 'right' });
		}
		b.y += 8;
	}

	if (r.notiz && wahl.texte) {
		b.absatz(r.notiz, 11, 'italic', GRAU);
		b.y += 6;
	}

	// --- Tage ---
	const notizenZeigen = (ns: Notiz[]) => {
		if (!wahl.texte) return;
		for (const n of ns) {
			b.absatz(notizZeit(n.zeit), 8, 'bold', GRAU, RAND + 8, INNEN - 8);
			b.absatz(n.text, 10, 'normal', TEXT, RAND + 8, INNEN - 8);
			b.y += 1.5;
		}
	};
	const SPALTEN = 3;
	const ABSTAND = 2.5;
	const FB = (INNEN - 8 - (SPALTEN - 1) * ABSTAND) / SPALTEN;
	const FH = FB * 0.75;
	const fotoRaster = async (fs: Foto[]) => {
		if (!wahl.fotos || !fs.length) return;
		// erst laden, dann setzen: Fotos, die nicht zu laden sind, hinterlassen keine Lücke
		const bilder = (await Promise.all(fs.map((f) => foto(f, 760, 570)))).filter((x): x is string => !!x);
		if (!bilder.length) return;
		b.y += 1.5;
		for (let i = 0; i < bilder.length; i += SPALTEN) {
			b.platz(FH + ABSTAND);
			bilder.slice(i, i + SPALTEN).forEach((bild, k) => doc.addImage(bild, 'JPEG', RAND + 8 + k * (FB + ABSTAND), b.y, FB, FH, undefined, 'FAST'));
			b.y += FH + ABSTAND;
		}
		b.y += 1;
	};
	const ausgaben = (e: Eintrag) =>
		wahl.kosten ? (e.kosten ?? []).map((k) => `${kostenName(k)} ${preisText(k.betrag, k.waehrung)}`) : [];
	const meta = (e: Eintrag): string => {
		const teile: string[] = [];
		if (e.typ === 'drive') {
			if (e.km) teile.push(`${zahl(e.km)} km`);
			if (e.minuten) teile.push(dauer(e.minuten));
			if (e.via?.length) teile.push('über ' + e.via.map((o) => o.name ?? 'Zwischenziel').join(', '));
		} else if (e.typ === 'stay') {
			const n = e.naechte ?? 1;
			teile.push(`${n} ${n === 1 ? 'Nacht' : 'Nächte'}`);
			if (e.bewertung) teile.push(`Bewertung ${e.bewertung}/5`);
			if (wahl.kosten && e.preis) teile.push(`${preisText(e.preis, e.waehrung)} pro Nacht`);
		}
		if (e.typ !== 'drive' && e.ort?.name && e.ort.name !== e.titel) teile.push(e.ort.name);
		if (e.ort?.land && e.typ !== 'drive') teile.push(e.ort.land);
		return [...teile, ...ausgaben(e)].join(' · ');
	};
	const markierung = (art: 'stay' | 'drive' | 'outing' | 'nacht', y: number) => {
		doc.setDrawColor(farbe);
		doc.setFillColor(art === 'stay' ? farbe : '#ffffff');
		doc.setLineWidth(0.5);
		doc.circle(RAND + 2.5, y, art === 'nacht' ? 1.1 : 1.7, art === 'stay' ? 'F' : 'D');
	};
	const eintrag = async (e: Eintrag) => {
		b.platz(14);
		const start = b.y;
		markierung(e.typ, start + 4.2);
		b.schrift(7.5, 'bold', GRAU);
		doc.setCharSpace(0.4);
		doc.text(t(TYP_NAME[e.typ].toUpperCase()), RAND + 8, start + 7.5 * PT);
		doc.setCharSpace(0);
		b.y += 3.6;
		b.absatz(e.titel, 12.5, 'bold', TEXT, RAND + 8, INNEN - 8);
		const m = meta(e);
		if (m) b.absatz(m, 9.5, 'normal', GRAU, RAND + 8, INNEN - 8);
		if (wahl.texte && e.text) {
			b.y += 1;
			b.absatz(e.text, 10.5, 'normal', TEXT, RAND + 8, INNEN - 8);
		}
		if (e.typ === 'stay') {
			b.y += 1;
			notizenZeigen(nachtNotizen(e, e.datum));
		}
		await fotoRaster(fotosVonEintrag(e.id).sort((a, c) => a.aufgenommen.localeCompare(c.aufgenommen)));
		b.y += 4;
	};

	// Trennlinie zu den Tagen – nicht, wenn die Tage ohnehin auf einer neuen Seite beginnen
	if (liste.length) {
		b.platz(40);
		if (b.y > RAND) {
			doc.setDrawColor(LINIE);
			doc.setLineWidth(0.3);
			doc.line(RAND, b.y, RAND + INNEN, b.y);
			b.y += 8;
		}
	}
	for (const tag of liste) {
		// Tageskopf nicht allein unten auf der Seite stehen lassen
		b.platz(10 + (wahl.fotos && tag.fotos.length ? FH + 4 : 18));
		// Tageskopf: „TAG 1“ in Reisefarbe, Datum, Wetter rechts
		const nr = t(`TAG ${reiseTag(r.start, tag.datum)}`);
		b.schrift(8.5, 'bold', '#ffffff');
		const nb = doc.getTextWidth(nr) + 5;
		doc.setFillColor(farbe);
		doc.roundedRect(RAND, b.y, nb, 6, 1, 1, 'F');
		doc.text(nr, RAND + 2.5, b.y + 4.2);
		b.schrift(10, 'bold', GRAU);
		doc.text(t(tagLang(tag.datum)), RAND + nb + 3, b.y + 4.3);
		const w = tagesWetter(tag);
		if (w) {
			b.schrift(10, 'normal', GRAU);
			doc.text(t(`${wetterArt(w.c).name} · ${w.max}° / ${w.min}°`), RAND + INNEN, b.y + 4.3, { align: 'right' });
		}
		b.y += 10;
		await fotoRaster(tag.fotos);

		// Reihenfolge wie in der Zeitleiste: Fahrten/Ausflüge, dann Folgenächte, dann neue Übernachtung
		const ersteNacht = tag.eintraege.findIndex((e) => e.typ === 'stay');
		const tagsueber = ersteNacht < 0 ? tag.eintraege : tag.eintraege.slice(0, ersteNacht);
		const nachts = ersteNacht < 0 ? [] : tag.eintraege.slice(ersteNacht);
		for (const e of tagsueber) await eintrag(e);
		for (const n of tag.naechte) {
			b.platz(9);
			markierung('nacht', b.y + 2.4);
			b.absatz(`${n.eintrag.titel} · Nacht ${n.nr} von ${n.von}`, 10, 'normal', GRAU, RAND + 8, INNEN - 8);
			notizenZeigen(nachtNotizen(n.eintrag, tag.datum));
			b.y += 3;
		}
		for (const e of nachts) await eintrag(e);
		b.y += 3;
	}

	const weitere = wahl.fotos ? weitereFotos(r.id) : [];
	if (weitere.length) {
		b.platz(30);
		b.absatz('Weitere Fotos', 13, 'bold');
		await fotoRaster(weitere);
	}

	// --- Kosten ---
	if (wahl.kosten) {
		const posten = reiseKosten(r.id);
		if (posten.length) {
			const betrag = (x: Betraege) =>
				Object.entries(x)
					.map(([wae, v]) => preisText(Math.round(v * 100) / 100, wae))
					.join(' + ');
			b.platz(20 + posten.length * 7);
			b.y += 4;
			b.absatz('Kosten', 13, 'bold');
			b.y += 2;
			const zeile = (name: string, wert: string, fett = false) => {
				b.schrift(10.5, fett ? 'bold' : 'normal');
				doc.text(t(name), RAND, b.y + 4);
				doc.text(t(wert), RAND + INNEN, b.y + 4, { align: 'right' });
				b.y += 6.5;
			};
			for (const p of posten) zeile(p.name, betrag(p.betraege));
			doc.setDrawColor(LINIE);
			doc.line(RAND, b.y + 0.5, RAND + INNEN, b.y + 0.5);
			b.y += 1.5;
			const s = summe(posten);
			const euro = wechselkurse.inEuro(s);
			zeile('Zusammen', nurEuro(s) || euro === null ? betrag(s) : `ca. ${preisText(Math.round(euro), 'EUR')}`, true);
		}
	}

	// --- Fußzeile auf jeder Seite ---
	const seiten = doc.getNumberOfPages();
	for (let i = 1; i <= seiten; i++) {
		doc.setPage(i);
		b.schrift(8, 'normal', GRAU);
		doc.text(t(r.titel), RAND, HOEHE - 9);
		doc.text(`${i} / ${seiten}`, RAND + INNEN, HOEHE - 9, { align: 'right' });
	}

	const name = r.titel.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Reise';
	return new File([doc.output('blob')], `${name}.pdf`, { type: 'application/pdf' });
}
