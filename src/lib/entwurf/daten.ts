// Beispieldaten nur für die Design-Entwürfe (kein echtes Datenmodell).
import routen from './routen.json';

export type Typ = 'stay' | 'drive' | 'outing' | 'event';
export type LngLat = [number, number];

export interface Urlaub {
	id: string;
	titel: string;
	start: string;
	ende: string;
	farbe: number;
	cover: string;
	laender: string[];
}
export interface Platz {
	id: string;
	name: string;
	art: 'Campingplatz' | 'Stellplatz' | 'Frei stehen' | 'Bauernhof';
	lat: number;
	lng: number;
	ort: string;
	land: string;
	ausstattung: string[];
	notiz: string;
	wiederkommen: boolean;
}
export interface Eintrag {
	id: string;
	urlaub: string;
	typ: Typ;
	titel: string;
	datum: string;
	lat: number;
	lng: number;
	ort: string;
	text?: string;
	platz?: string;
	naechte?: number;
	preis?: string;
	bewertung?: number;
	km?: number;
	min?: number;
	route?: LngLat[];
}
export interface Foto {
	id: string;
	urlaub: string;
	eintrag?: string;
	lat: number;
	lng: number;
	datum: string;
	motiv: Motiv;
	hoch?: boolean;
}
export type Motiv = 'fjord' | 'kueste' | 'alpen' | 'abend' | 'wald' | 'nebel';

const R = routen as unknown as Record<string, { km: number; min: number; coords: LngLat[] }[]>;

export const urlaube: Urlaub[] = [
	{ id: 'no25', titel: 'Norwegen', start: '2025-07-05', ende: '2025-07-19', farbe: 0, cover: 'f-no-3', laender: ['NO'] },
	{ id: 'br24', titel: 'Bretagne', start: '2024-05-10', ende: '2024-05-24', farbe: 1, cover: 'f-br-2', laender: ['FR'] },
	{ id: 'do23', titel: 'Dolomiten im Herbst', start: '2023-09-14', ende: '2023-09-24', farbe: 2, cover: 'f-do-1', laender: ['IT'] }
];

export const plaetze: Platz[] = [
	{ id: 'p1', name: 'Roligheden Camping', art: 'Campingplatz', lat: 58.1467, lng: 8.0336, ort: 'Kristiansand', land: 'Norwegen', ausstattung: ['strom', 'wasser', 'dusche', 'wc', 'wlan', 'entsorgung'], notiz: 'Stadtnah, Bus ins Zentrum. Sanitär sauber.', wiederkommen: true },
	{ id: 'p2', name: 'Preikestolen Camping', art: 'Campingplatz', lat: 58.9939, lng: 6.0917, ort: 'Jørpeland', land: 'Norwegen', ausstattung: ['strom', 'wasser', 'dusche', 'wc', 'hunde', 'laden', 'entsorgung'], notiz: 'Terrassen mit Blick ins Tal. Früh los zum Preikestolen, ab 9 Uhr voll.', wiederkommen: true },
	{ id: 'p3', name: 'Odda Camping', art: 'Campingplatz', lat: 60.058, lng: 6.546, ort: 'Odda', land: 'Norwegen', ausstattung: ['strom', 'wasser', 'dusche', 'wc'], notiz: 'Am See, etwas eng. Shuttle zur Trolltunga.', wiederkommen: false },
	{ id: 'p4', name: 'Geiranger Camping', art: 'Campingplatz', lat: 62.1007, lng: 7.2059, ort: 'Geiranger', land: 'Norwegen', ausstattung: ['strom', 'wasser', 'dusche', 'wc', 'wlan', 'hunde', 'entsorgung'], notiz: 'Direkt am Fjord, Kreuzfahrtschiffe zum Frühstück.', wiederkommen: true },
	{ id: 'p5', name: 'Bobilparkering Ålesund', art: 'Stellplatz', lat: 62.4722, lng: 6.1495, ort: 'Ålesund', land: 'Norwegen', ausstattung: ['strom', 'entsorgung'], notiz: 'Zentral, aber laut. Nur für eine Nacht.', wiederkommen: false },
	{ id: 'p6', name: 'Aire des Corsaires', art: 'Stellplatz', lat: 48.649, lng: -2.0257, ort: 'Saint-Malo', land: 'Frankreich', ausstattung: ['wasser', 'entsorgung', 'strom'], notiz: 'Shuttle in die Altstadt.', wiederkommen: true },
	{ id: 'p7', name: 'Camping du Cap Fréhel', art: 'Campingplatz', lat: 48.684, lng: -2.317, ort: 'Plévenon', land: 'Frankreich', ausstattung: ['strom', 'wasser', 'dusche', 'wc', 'hunde'], notiz: 'Heide, Wind, Leuchtturm zu Fuß.', wiederkommen: true },
	{ id: 'p8', name: 'Ferme de Ploumanac’h', art: 'Bauernhof', lat: 48.83, lng: -3.483, ort: 'Perros-Guirec', land: 'Frankreich', ausstattung: ['wasser', 'wc'], notiz: 'France Passion. Cidre und Galettes vom Hof.', wiederkommen: true },
	{ id: 'p9', name: 'Pointe de Dinan', art: 'Frei stehen', lat: 48.246, lng: -4.489, ort: 'Crozon', land: 'Frankreich', ausstattung: [], notiz: 'Parkplatz über den Klippen, nachts ganz allein.', wiederkommen: true },
	{ id: 'p10', name: 'Camping Les Menhirs', art: 'Campingplatz', lat: 47.584, lng: -3.077, ort: 'Carnac', land: 'Frankreich', ausstattung: ['strom', 'wasser', 'dusche', 'wc', 'wlan', 'laden'], notiz: 'Groß und voll, aber nah an den Steinreihen.', wiederkommen: false },
	{ id: 'p11', name: 'Camping Olympia', art: 'Campingplatz', lat: 46.733, lng: 12.222, ort: 'Toblach', land: 'Italien', ausstattung: ['strom', 'wasser', 'dusche', 'wc', 'wlan', 'hunde', 'entsorgung', 'laden'], notiz: 'Wellness inklusive, Brötchen am Platz.', wiederkommen: true },
	{ id: 'p12', name: 'Camping Rocchetta', art: 'Campingplatz', lat: 46.538, lng: 12.135, ort: 'Cortina d’Ampezzo', land: 'Italien', ausstattung: ['strom', 'wasser', 'dusche', 'wc'], notiz: '', wiederkommen: false },
	{ id: 'p13', name: 'Wohnmobilstellplatz Seiser Alm', art: 'Stellplatz', lat: 46.568, lng: 11.561, ort: 'Kastelruth', land: 'Italien', ausstattung: ['strom', 'wasser', 'entsorgung', 'wc'], notiz: 'Seilbahn zur Seiser Alm direkt nebenan.', wiederkommen: true },
	{ id: 'p14', name: 'Camping Bavaria', art: 'Campingplatz', lat: 45.885, lng: 10.842, ort: 'Riva del Garda', land: 'Italien', ausstattung: ['strom', 'wasser', 'dusche', 'wc', 'wlan'], notiz: 'Direkt am Wasser, abends Pizza um die Ecke.', wiederkommen: true }
];

const pl = (id: string) => plaetze.find((p) => p.id === id)!;
let n = 0;
function stay(urlaub: string, platz: string, datum: string, naechte: number, bewertung: number, preis: string, text?: string): Eintrag {
	const p = pl(platz);
	return { id: 'e' + ++n, urlaub, typ: 'stay', titel: p.name, datum, lat: p.lat, lng: p.lng, ort: p.ort, platz, naechte, bewertung, preis, text };
}
function drive(urlaub: string, i: number, datum: string, von: string, nach: string): Eintrag {
	const r = R[urlaub === 'no25' ? 'norwegen' : urlaub === 'br24' ? 'bretagne' : 'dolomiten'][i];
	const end = r.coords[r.coords.length - 1];
	return { id: 'e' + ++n, urlaub, typ: 'drive', titel: `${von} → ${nach}`, datum, lat: end[1], lng: end[0], ort: nach, km: r.km, min: r.min, route: r.coords };
}
function other(urlaub: string, typ: Typ, titel: string, datum: string, lat: number, lng: number, ort: string, text?: string): Eintrag {
	return { id: 'e' + ++n, urlaub, typ, titel, datum, lat, lng, ort, text };
}

export const eintraege: Eintrag[] = [
	stay('no25', 'p1', '2025-07-05', 2, 4, '420 NOK', 'Nach der Fähre aus Hirtshals erstmal ankommen.'),
	drive('no25', 0, '2025-07-07', 'Kristiansand', 'Jørpeland'),
	stay('no25', 'p2', '2025-07-07', 2, 5, '390 NOK'),
	other('no25', 'outing', 'Wanderung Preikestolen', '2025-07-08', 58.9864, 6.1904, 'Preikestolen', 'Um 6 Uhr gestartet, oben fast allein. 4 Stunden hin und zurück.'),
	drive('no25', 1, '2025-07-09', 'Jørpeland', 'Odda'),
	stay('no25', 'p3', '2025-07-09', 3, 3, '350 NOK'),
	other('no25', 'outing', 'Trolltunga', '2025-07-10', 60.124, 6.74, 'Skjeggedal', '27 km, 10 Stunden. Beine am Ende.'),
	other('no25', 'event', 'Cider-Probe in Hardanger', '2025-07-11', 60.32, 6.66, 'Lofthus'),
	drive('no25', 2, '2025-07-12', 'Odda', 'Geiranger'),
	stay('no25', 'p4', '2025-07-12', 4, 5, '410 NOK', 'Bester Platz der Reise.'),
	other('no25', 'outing', 'Dalsnibba bei Sonnenaufgang', '2025-07-14', 62.047, 7.272, 'Dalsnibba'),
	drive('no25', 3, '2025-07-16', 'Geiranger', 'Ålesund'),
	stay('no25', 'p5', '2025-07-16', 2, 2, '300 NOK'),

	stay('br24', 'p6', '2024-05-10', 2, 3, '14 €'),
	other('br24', 'outing', 'Mont-Saint-Michel', '2024-05-11', 48.636, -1.511, 'Le Mont-Saint-Michel', 'Mit dem Rad über den Damm, Flut kam pünktlich.'),
	drive('br24', 0, '2024-05-12', 'Saint-Malo', 'Cap Fréhel'),
	stay('br24', 'p7', '2024-05-12', 3, 4, '28 €'),
	drive('br24', 1, '2024-05-15', 'Cap Fréhel', 'Ploumanac’h'),
	stay('br24', 'p8', '2024-05-15', 2, 5, 'gratis', 'Die Bäuerin hat uns Crêpes gebracht.'),
	drive('br24', 2, '2024-05-17', 'Ploumanac’h', 'Crozon'),
	stay('br24', 'p9', '2024-05-17', 3, 5, 'gratis'),
	other('br24', 'event', 'Fest-Noz in Crozon', '2024-05-18', 48.247, -4.49, 'Crozon', 'Bretonischer Tanzabend, alle Generationen.'),
	drive('br24', 3, '2024-05-20', 'Crozon', 'Carnac'),
	stay('br24', 'p10', '2024-05-20', 4, 3, '36 €'),

	stay('do23', 'p11', '2023-09-14', 3, 5, '52 €'),
	other('do23', 'outing', 'Drei Zinnen Umrundung', '2023-09-15', 46.6187, 12.3021, 'Auronzo-Hütte'),
	drive('do23', 0, '2023-09-17', 'Toblach', 'Cortina'),
	stay('do23', 'p12', '2023-09-17', 2, 3, '38 €'),
	drive('do23', 1, '2023-09-19', 'Cortina', 'Kastelruth'),
	stay('do23', 'p13', '2023-09-19', 3, 4, '25 €'),
	other('do23', 'event', 'Almabtrieb Kastelruth', '2023-09-21', 46.567, 11.56, 'Kastelruth'),
	drive('do23', 2, '2023-09-22', 'Kastelruth', 'Riva'),
	stay('do23', 'p14', '2023-09-22', 2, 4, '44 €')
];

function f(id: string, urlaub: string, datum: string, lat: number, lng: number, motiv: Motiv, hoch = false): Foto {
	return { id, urlaub, datum, lat, lng, motiv, hoch };
}
export const fotos: Foto[] = [
	f('f-no-1', 'no25', '2025-07-06', 58.144, 8.0, 'kueste'),
	f('f-no-2', 'no25', '2025-07-08', 58.9864, 6.1904, 'fjord', true),
	f('f-no-3', 'no25', '2025-07-08', 58.985, 6.186, 'fjord'),
	f('f-no-4', 'no25', '2025-07-10', 60.124, 6.74, 'nebel', true),
	f('f-no-5', 'no25', '2025-07-11', 60.32, 6.66, 'wald'),
	f('f-no-6', 'no25', '2025-07-13', 62.1, 7.2, 'fjord'),
	f('f-no-7', 'no25', '2025-07-14', 62.047, 7.272, 'abend', true),
	f('f-no-8', 'no25', '2025-07-14', 62.05, 7.27, 'abend'),
	f('f-no-9', 'no25', '2025-07-17', 62.472, 6.155, 'kueste'),
	f('f-br-1', 'br24', '2024-05-11', 48.636, -1.511, 'nebel'),
	f('f-br-2', 'br24', '2024-05-13', 48.684, -2.317, 'kueste'),
	f('f-br-3', 'br24', '2024-05-16', 48.83, -3.483, 'abend', true),
	f('f-br-4', 'br24', '2024-05-18', 48.246, -4.489, 'kueste'),
	f('f-br-5', 'br24', '2024-05-19', 48.25, -4.5, 'abend'),
	f('f-br-6', 'br24', '2024-05-21', 47.584, -3.077, 'wald'),
	f('f-do-1', 'do23', '2023-09-15', 46.6187, 12.3021, 'alpen'),
	f('f-do-2', 'do23', '2023-09-16', 46.73, 12.23, 'wald', true),
	f('f-do-3', 'do23', '2023-09-18', 46.54, 12.13, 'alpen'),
	f('f-do-4', 'do23', '2023-09-20', 46.55, 11.6, 'nebel'),
	f('f-do-5', 'do23', '2023-09-21', 46.567, 11.56, 'alpen', true),
	f('f-do-6', 'do23', '2023-09-23', 45.885, 10.842, 'abend')
];

// Abgeleitete Werte
export const eintraegeVon = (u: string) => eintraege.filter((e) => e.urlaub === u);
export const fotosVon = (u: string) => fotos.filter((f) => f.urlaub === u);
export const naechte = (u: string) => eintraegeVon(u).reduce((s, e) => s + (e.naechte ?? 0), 0);
export const km = (u: string) => eintraegeVon(u).reduce((s, e) => s + (e.km ?? 0), 0);
export const besuche = (p: string) => eintraege.filter((e) => e.platz === p);
export function platzBewertung(p: string) {
	const b = besuche(p).filter((e) => e.bewertung);
	return b.length ? b.reduce((s, e) => s + e.bewertung!, 0) / b.length : 0;
}
