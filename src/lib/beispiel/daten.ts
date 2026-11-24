/*
  Beispielreisen zum Ausprobieren (erfunden, mit echten Straßenrouten von OSRM).
  Alle IDs beginnen mit „bsp-“, damit sie sich sauber wieder entfernen lassen.
*/
import routen from './routen.json';
import { fotoUrl, type Motiv } from './bilder.ts';
import { db } from '#lib/db/db.ts';
import { daten } from '#lib/db/daten.svelte.ts';
import { ui } from '#lib/ui.svelte.ts';
import type { Eintrag, Foto, LngLat, Platz, PlatzArt, Reise, TabellenName } from '#lib/db/typen.ts';

const R = routen as unknown as Record<string, { km: number; min: number; coords: LngLat[] }[]>;
const jetzt = Date.now();
const basis = (id: string) => ({ id: 'bsp-' + id, geaendert: jetzt, geloescht: false });

const reisen: Reise[] = [
	{ ...basis('no25'), titel: 'Norwegen', start: '2025-07-05', ende: '2025-07-19', farbe: 0, titelbild: 'bsp-f-no-3' },
	{ ...basis('br24'), titel: 'Bretagne', start: '2024-05-10', ende: '2024-05-24', farbe: 1, titelbild: 'bsp-f-br-2' },
	{ ...basis('do23'), titel: 'Dolomiten im Herbst', start: '2023-09-14', ende: '2023-09-24', farbe: 2, titelbild: 'bsp-f-do-1' }
];

function platz(id: string, name: string, art: PlatzArt, lat: number, lng: number, ort: string, land: string, ausstattung: string[], notiz: string, wiederkommen: boolean): Platz {
	return { ...basis(id), name, art, ort: { lat, lng, name: ort, land }, ausstattung, notiz, wiederkommen };
}

const plaetze: Platz[] = [
	platz('p1', 'Roligheden Camping', 'camping', 58.1467, 8.0336, 'Kristiansand', 'Norwegen', ['strom', 'wasser', 'dusche', 'wc', 'wlan', 'entsorgung'], 'Stadtnah, Bus ins Zentrum. Sanitär sauber.', true),
	platz('p2', 'Preikestolen Camping', 'camping', 58.9939, 6.0917, 'Jørpeland', 'Norwegen', ['strom', 'wasser', 'dusche', 'wc', 'hunde', 'laden', 'entsorgung'], 'Terrassen mit Blick ins Tal. Früh los zum Preikestolen, ab 9 Uhr voll.', true),
	platz('p3', 'Odda Camping', 'camping', 60.058, 6.546, 'Odda', 'Norwegen', ['strom', 'wasser', 'dusche', 'wc'], 'Am See, etwas eng. Shuttle zur Trolltunga.', false),
	platz('p4', 'Geiranger Camping', 'camping', 62.1007, 7.2059, 'Geiranger', 'Norwegen', ['strom', 'wasser', 'dusche', 'wc', 'wlan', 'hunde', 'entsorgung'], 'Direkt am Fjord, Kreuzfahrtschiffe zum Frühstück.', true),
	platz('p5', 'Bobilparkering Ålesund', 'stellplatz', 62.4722, 6.1495, 'Ålesund', 'Norwegen', ['strom', 'entsorgung'], 'Zentral, aber laut. Nur für eine Nacht.', false),
	platz('p6', 'Aire des Corsaires', 'stellplatz', 48.649, -2.0257, 'Saint-Malo', 'Frankreich', ['wasser', 'entsorgung', 'strom'], 'Shuttle in die Altstadt.', true),
	platz('p7', 'Camping du Cap Fréhel', 'camping', 48.684, -2.317, 'Plévenon', 'Frankreich', ['strom', 'wasser', 'dusche', 'wc', 'hunde'], 'Heide, Wind, Leuchtturm zu Fuß.', true),
	platz('p8', 'Ferme de Ploumanac’h', 'hof', 48.83, -3.483, 'Perros-Guirec', 'Frankreich', ['wasser', 'wc'], 'France Passion. Cidre und Galettes vom Hof.', true),
	platz('p9', 'Pointe de Dinan', 'frei', 48.246, -4.489, 'Crozon', 'Frankreich', [], 'Parkplatz über den Klippen, nachts ganz allein.', true),
	platz('p10', 'Camping Les Menhirs', 'camping', 47.584, -3.077, 'Carnac', 'Frankreich', ['strom', 'wasser', 'dusche', 'wc', 'wlan', 'laden'], 'Groß und voll, aber nah an den Steinreihen.', false),
	platz('p11', 'Camping Olympia', 'camping', 46.733, 12.222, 'Toblach', 'Italien', ['strom', 'wasser', 'dusche', 'wc', 'wlan', 'hunde', 'entsorgung', 'laden'], 'Wellness inklusive, Brötchen am Platz.', true),
	platz('p12', 'Camping Rocchetta', 'camping', 46.538, 12.135, 'Cortina d’Ampezzo', 'Italien', ['strom', 'wasser', 'dusche', 'wc'], '', false),
	platz('p13', 'Wohnmobilstellplatz Seiser Alm', 'stellplatz', 46.568, 11.561, 'Kastelruth', 'Italien', ['strom', 'wasser', 'entsorgung', 'wc'], 'Seilbahn zur Seiser Alm direkt nebenan.', true),
	platz('p14', 'Camping Bavaria', 'camping', 45.885, 10.842, 'Riva del Garda', 'Italien', ['strom', 'wasser', 'dusche', 'wc', 'wlan'], 'Direkt am Wasser, abends Pizza um die Ecke.', true)
];

const pl = (id: string) => plaetze.find((p) => p.id === 'bsp-' + id)!;
let n = 0;
function stay(reise: string, platzId: string, datum: string, naechte: number, bewertung: number, preis: number, waehrung: string, text?: string): Eintrag {
	const p = pl(platzId);
	return { ...basis('e' + ++n), reise: 'bsp-' + reise, typ: 'stay', titel: p.name, datum, ort: p.ort, platz: p.id, naechte, bewertung, preis, waehrung, text };
}
function drive(reise: string, i: number, datum: string, von: string, nach: string): Eintrag {
	const r = R[reise === 'no25' ? 'norwegen' : reise === 'br24' ? 'bretagne' : 'dolomiten'][i];
	const a = r.coords[0],
		b = r.coords[r.coords.length - 1];
	return {
		...basis('e' + ++n),
		reise: 'bsp-' + reise,
		typ: 'drive',
		titel: `${von} → ${nach}`,
		datum,
		von: { lng: a[0], lat: a[1], name: von },
		nach: { lng: b[0], lat: b[1], name: nach },
		km: r.km,
		minuten: r.min,
		route: r.coords,
		routeOk: true
	};
}
function anderes(reise: string, typ: 'outing' | 'event', titel: string, datum: string, lat: number, lng: number, ort: string, text?: string): Eintrag {
	return { ...basis('e' + ++n), reise: 'bsp-' + reise, typ, titel, datum, ort: { lat, lng, name: ort }, text };
}

const eintraege: Eintrag[] = [
	stay('no25', 'p1', '2025-07-05', 2, 4, 420, 'NOK', 'Nach der Fähre aus Hirtshals erstmal ankommen.'),
	drive('no25', 0, '2025-07-07', 'Kristiansand', 'Jørpeland'),
	stay('no25', 'p2', '2025-07-07', 2, 5, 390, 'NOK'),
	anderes('no25', 'outing', 'Wanderung Preikestolen', '2025-07-08', 58.9864, 6.1904, 'Preikestolen', 'Um 6 Uhr gestartet, oben fast allein. 4 Stunden hin und zurück.'),
	drive('no25', 1, '2025-07-09', 'Jørpeland', 'Odda'),
	stay('no25', 'p3', '2025-07-09', 3, 3, 350, 'NOK'),
	anderes('no25', 'outing', 'Trolltunga', '2025-07-10', 60.124, 6.74, 'Skjeggedal', '27 km, 10 Stunden. Beine am Ende.'),
	anderes('no25', 'event', 'Cider-Probe in Hardanger', '2025-07-11', 60.32, 6.66, 'Lofthus'),
	drive('no25', 2, '2025-07-12', 'Odda', 'Geiranger'),
	stay('no25', 'p4', '2025-07-12', 4, 5, 410, 'NOK', 'Bester Platz der Reise.'),
	anderes('no25', 'outing', 'Dalsnibba bei Sonnenaufgang', '2025-07-14', 62.047, 7.272, 'Dalsnibba'),
	drive('no25', 3, '2025-07-16', 'Geiranger', 'Ålesund'),
	stay('no25', 'p5', '2025-07-16', 2, 2, 300, 'NOK'),

	stay('br24', 'p6', '2024-05-10', 2, 3, 14, 'EUR'),
	anderes('br24', 'outing', 'Mont-Saint-Michel', '2024-05-11', 48.636, -1.511, 'Le Mont-Saint-Michel', 'Mit dem Rad über den Damm, die Flut kam pünktlich.'),
	drive('br24', 0, '2024-05-12', 'Saint-Malo', 'Cap Fréhel'),
	stay('br24', 'p7', '2024-05-12', 3, 4, 28, 'EUR'),
	drive('br24', 1, '2024-05-15', 'Cap Fréhel', 'Ploumanac’h'),
	stay('br24', 'p8', '2024-05-15', 2, 5, 0, 'EUR', 'Die Bäuerin hat uns Crêpes gebracht.'),
	drive('br24', 2, '2024-05-17', 'Ploumanac’h', 'Crozon'),
	stay('br24', 'p9', '2024-05-17', 3, 5, 0, 'EUR'),
	anderes('br24', 'event', 'Fest-Noz in Crozon', '2024-05-18', 48.247, -4.49, 'Crozon', 'Bretonischer Tanzabend, alle Generationen.'),
	drive('br24', 3, '2024-05-20', 'Crozon', 'Carnac'),
	stay('br24', 'p10', '2024-05-20', 4, 3, 36, 'EUR'),

	stay('do23', 'p11', '2023-09-14', 3, 5, 52, 'EUR'),
	anderes('do23', 'outing', 'Drei Zinnen Umrundung', '2023-09-15', 46.6187, 12.3021, 'Auronzo-Hütte'),
	drive('do23', 0, '2023-09-17', 'Toblach', 'Cortina'),
	stay('do23', 'p12', '2023-09-17', 2, 3, 38, 'EUR'),
	drive('do23', 1, '2023-09-19', 'Cortina', 'Kastelruth'),
	stay('do23', 'p13', '2023-09-19', 3, 4, 25, 'EUR'),
	anderes('do23', 'event', 'Almabtrieb Kastelruth', '2023-09-21', 46.567, 11.56, 'Kastelruth'),
	drive('do23', 2, '2023-09-22', 'Kastelruth', 'Riva'),
	stay('do23', 'p14', '2023-09-22', 2, 4, 44, 'EUR')
];

function foto(id: string, reise: string, zeit: string, lat: number, lng: number, motiv: Motiv, hoch = false): Foto {
	return {
		...basis(id),
		reise: 'bsp-' + reise,
		ort: { lat, lng },
		aufgenommen: zeit,
		breite: hoch ? 600 : 800,
		hoehe: hoch ? 800 : 600,
		vorschau: fotoUrl(id, motiv, hoch)
	};
}
const fotos: Foto[] = [
	foto('f-no-1', 'no25', '2025-07-06T18:20:00', 58.144, 8.0, 'kueste'),
	foto('f-no-2', 'no25', '2025-07-08T08:05:00', 58.9864, 6.1904, 'fjord', true),
	foto('f-no-3', 'no25', '2025-07-08T08:40:00', 58.985, 6.186, 'fjord'),
	foto('f-no-4', 'no25', '2025-07-10T12:10:00', 60.124, 6.74, 'nebel', true),
	foto('f-no-5', 'no25', '2025-07-11T16:00:00', 60.32, 6.66, 'wald'),
	foto('f-no-6', 'no25', '2025-07-13T09:30:00', 62.1, 7.2, 'fjord'),
	foto('f-no-7', 'no25', '2025-07-14T04:50:00', 62.047, 7.272, 'abend', true),
	foto('f-no-8', 'no25', '2025-07-14T05:10:00', 62.05, 7.27, 'abend'),
	foto('f-no-9', 'no25', '2025-07-17T11:00:00', 62.472, 6.155, 'kueste'),
	foto('f-br-1', 'br24', '2024-05-11T15:00:00', 48.636, -1.511, 'nebel'),
	foto('f-br-2', 'br24', '2024-05-13T19:40:00', 48.684, -2.317, 'kueste'),
	foto('f-br-3', 'br24', '2024-05-16T21:15:00', 48.83, -3.483, 'abend', true),
	foto('f-br-4', 'br24', '2024-05-18T10:20:00', 48.246, -4.489, 'kueste'),
	foto('f-br-5', 'br24', '2024-05-19T21:30:00', 48.25, -4.5, 'abend'),
	foto('f-br-6', 'br24', '2024-05-21T13:00:00', 47.584, -3.077, 'wald'),
	foto('f-do-1', 'do23', '2023-09-15T10:00:00', 46.6187, 12.3021, 'alpen'),
	foto('f-do-2', 'do23', '2023-09-16T09:15:00', 46.73, 12.23, 'wald', true),
	foto('f-do-3', 'do23', '2023-09-18T14:00:00', 46.54, 12.13, 'alpen'),
	foto('f-do-4', 'do23', '2023-09-20T08:00:00', 46.55, 11.6, 'nebel'),
	foto('f-do-5', 'do23', '2023-09-21T11:30:00', 46.567, 11.56, 'alpen', true),
	foto('f-do-6', 'do23', '2023-09-23T19:50:00', 45.885, 10.842, 'abend')
];

/** Beispieldaten in die lokale Datenbank schreiben (nicht in die Outbox: sie sollen nie hochgeladen werden) */
export async function beispielLaden() {
	await db.transaction('rw', db.reisen, db.eintraege, db.plaetze, db.fotos, async () => {
		await db.reisen.bulkPut(reisen);
		await db.eintraege.bulkPut(eintraege);
		await db.plaetze.bulkPut(plaetze);
		await db.fotos.bulkPut(fotos);
	});
	await daten.laden();
	ui.zeigeAlles();
	ui.zeige('Drei Beispielreisen geladen');
}

export const hatBeispiel = () => daten.reisen.some((r) => r.id.startsWith('bsp-'));

/** Entfernt alle Beispieldaten (und alles, was darauf verweist). Mit Rückgängig. */
export async function beispielEntfernen() {
	const teile: [TabellenName, string][] = [];
	for (const t of ['reisen', 'eintraege', 'plaetze', 'fotos'] as const)
		for (const x of daten[t]) if (x.id.startsWith('bsp-') || ('reise' in x && x.reise?.startsWith('bsp-'))) teile.push([t, x.id]);
	return daten.loeschenAlle(teile);
}
