// Drei Stilrichtungen für die Design-Entwürfe.
import type { KartenFarben } from '#lib/map/stil.ts';

export type Variante = 'atlas' | 'nacht' | 'wegweiser' | 'mix';

export interface Modus {
	vars: Record<string, string>;
	karte: KartenFarben;
	reiseFarben: string[];
}

export interface Stil extends Modus {
	id: Variante;
	buchstabe: string;
	name: string;
	idee: string;
	dunkel: boolean;
	/** eigener Dunkelmodus (nur beim gemischten Entwurf) */
	nacht?: Modus;
}

export const stile: Stil[] = [
	{
		id: 'atlas',
		buchstabe: 'A',
		name: 'Atlas',
		idee: 'Wie ein gedrucktes Reisetagebuch: warmes Papier, Serifenschrift, feine Linien statt Kästen.',
		dunkel: false,
		vars: {
			'--grund': '#f4eee3',
			'--flaeche': '#fbf7f0',
			'--flaeche-2': '#efe7da',
			'--linie': '#e0d5c2',
			'--text': '#2a2622',
			'--text-2': '#73695c',
			'--akzent': '#c4553b',
			'--akzent-text': '#fff8f0',
			'--tief': '#1f4e55',
			'--schrift-kopf': "'Fraunces Variable', Georgia, serif",
			'--schrift-ui': "'Instrument Sans Variable', system-ui, sans-serif",
			'--kopf-gewicht': '520',
			'--kopf-stil': 'normal',
			'--kopf-sperrung': '-0.01em',
			'--radius': '12px',
			'--radius-gross': '20px',
			'--schatten': '0 -1px 0 #e0d5c2, 0 -12px 32px rgba(70, 50, 20, 0.10)',
			'--knopf-schatten': '0 6px 16px rgba(120, 50, 30, 0.28)'
		},
		karte: {
			land: '#eee5d4', park: '#e2e2c8', wald: '#d9dec1', wasser: '#b6cfcd', fluss: '#a4c2c1', eis: '#f8f5ee',
			siedlung: '#e8dcc7', gebaeude: '#e2d5bf', strasse: '#fbf7ef', strasseKlein: '#f4ecdf', strasseRand: '#d8cab1',
			grenze: '#b3a184', text: '#6b5d49', textStark: '#3b3124', textHalo: '#f2eadc', textWasser: '#4c7678', relief: 0.32
		},
		reiseFarben: ['#c4553b', '#1f6f78', '#7c8a2e', '#b5832a']
	},
	{
		id: 'nacht',
		buchstabe: 'B',
		name: 'Nachtfahrt',
		idee: 'Dunkel und ruhig, die Fotos leuchten. Große Bilder, Kursivschrift, Bernstein als Akzent.',
		dunkel: true,
		vars: {
			'--grund': '#101419',
			'--flaeche': '#181d24',
			'--flaeche-2': '#212832',
			'--linie': '#2a323d',
			'--text': '#eee8dc',
			'--text-2': '#98a1ab',
			'--akzent': '#f2a541',
			'--akzent-text': '#1b1305',
			'--tief': '#7fc4c9',
			'--schrift-kopf': "'Newsreader Variable', Georgia, serif",
			'--schrift-ui': "'Figtree Variable', system-ui, sans-serif",
			'--kopf-gewicht': '450',
			'--kopf-stil': 'italic',
			'--kopf-sperrung': '-0.005em',
			'--radius': '16px',
			'--radius-gross': '26px',
			'--schatten': '0 -1px 0 #2a323d, 0 -16px 40px rgba(0, 0, 0, 0.45)',
			'--knopf-schatten': '0 8px 22px rgba(242, 165, 65, 0.30)'
		},
		karte: {
			land: '#151a20', park: '#17201c', wald: '#18221d', wasser: '#0b2029', fluss: '#10303c', eis: '#1d232a',
			siedlung: '#1a2027', gebaeude: '#20262e', strasse: '#2a323c', strasseKlein: '#222932', strasseRand: '#1b2128',
			grenze: '#3a4551', text: '#7b8693', textStark: '#c6ced6', textHalo: '#101419', textWasser: '#4b7a8c', relief: 0
		},
		reiseFarben: ['#f2a541', '#6cc3c9', '#e8735f', '#a9c46c']
	},
	{
		id: 'wegweiser',
		buchstabe: 'C',
		name: 'Wegweiser',
		idee: 'Klar und grafisch wie Verkehrsschilder: kräftige Zahlen, Waldgrün, ein Signal-Gelb, scharfe Kanten.',
		dunkel: false,
		vars: {
			'--grund': '#f6f6f2',
			'--flaeche': '#ffffff',
			'--flaeche-2': '#eff0eb',
			'--linie': '#e1e3dc',
			'--text': '#111914',
			'--text-2': '#5b655e',
			'--akzent': '#1d5c3a',
			'--akzent-text': '#ffffff',
			'--tief': '#1d5c3a',
			'--signal': '#f2c230',
			'--schrift-kopf': "'Instrument Sans Variable', system-ui, sans-serif",
			'--schrift-ui': "'Instrument Sans Variable', system-ui, sans-serif",
			'--kopf-gewicht': '680',
			'--kopf-stil': 'normal',
			'--kopf-sperrung': '-0.025em',
			'--radius': '6px',
			'--radius-gross': '14px',
			'--schatten': '0 -1px 0 #e1e3dc, 0 -10px 28px rgba(17, 25, 20, 0.08)',
			'--knopf-schatten': '0 6px 14px rgba(29, 92, 58, 0.30)'
		},
		karte: {
			land: '#f3f4f0', park: '#e2ecdc', wald: '#dae7d2', wasser: '#c3dde5', fluss: '#b1d1db', eis: '#ffffff',
			siedlung: '#ebece7', gebaeude: '#e3e4df', strasse: '#ffffff', strasseKlein: '#ffffff', strasseRand: '#d6d9d1',
			grenze: '#97a199', text: '#5d6660', textStark: '#18211b', textHalo: '#f6f6f2', textWasser: '#3c7080', relief: 0.18
		},
		reiseFarben: ['#1d5c3a', '#d9542b', '#2b5da8', '#c99a1e']
	}
];

// Gewählte Mischung: Schrift und Klarheit von C, große Bilder von B, eigener Dunkelmodus.
const wegweiser = stile.find((s) => s.id === 'wegweiser')!;
stile.push({
	...wegweiser,
	id: 'mix',
	buchstabe: 'D',
	name: 'Mischung',
	idee: 'Schrift und Klarheit von C, große Bildkarten von B, dazu ein eigener Dunkelmodus (folgt dem iPhone).',
	nacht: {
		vars: {
			...wegweiser.vars,
			'--grund': '#0e1311',
			'--flaeche': '#161c19',
			'--flaeche-2': '#1f2723',
			'--linie': '#2a3430',
			'--text': '#edf2ee',
			'--text-2': '#97a39c',
			'--akzent': '#5cbf8a',
			'--akzent-text': '#06120b',
			'--tief': '#1f4532',
			'--signal': '#f2c230',
			'--schatten': '0 -1px 0 #2a3430, 0 -14px 36px rgba(0, 0, 0, 0.5)',
			'--knopf-schatten': '0 8px 20px rgba(92, 191, 138, 0.25)'
		},
		karte: {
			land: '#131a16', park: '#15201a', wald: '#16221b', wasser: '#0b1d24', fluss: '#11303a', eis: '#1b231f',
			siedlung: '#19201c', gebaeude: '#1f2722', strasse: '#29332d', strasseKlein: '#212a25', strasseRand: '#19201b',
			grenze: '#3a4740', text: '#7d8a83', textStark: '#d0d9d3', textHalo: '#0e1311', textWasser: '#4c7d8b', relief: 0
		},
		reiseFarben: ['#5cbf8a', '#f07a4f', '#79a3ea', '#e8bb3e']
	}
});

// Weitere Dunkel-Varianten für D (hell bleibt gleich)
function dunkelVariante(id: string, name: string, idee: string, vars: Record<string, string>, karte: KartenFarben, reiseFarben: string[]) {
	stile.push({
		...wegweiser,
		id: id as Variante,
		buchstabe: 'D',
		name,
		idee,
		nacht: { vars: { ...wegweiser.vars, ...vars }, karte, reiseFarben }
	});
}

dunkelVariante(
	'mix-blau',
	'Schilderblau',
	'Tiefes Autobahnschild-Blau, Signal-Gelb als Akzent.',
	{
		'--grund': '#0a1322',
		'--flaeche': '#101c30',
		'--flaeche-2': '#18263d',
		'--linie': '#243450',
		'--text': '#eef2f7',
		'--text-2': '#93a2b8',
		'--akzent': '#f2c230',
		'--akzent-text': '#141005',
		'--tief': '#1d4f8f',
		'--signal': '#f2c230',
		'--schatten': '0 -1px 0 #243450, 0 -14px 36px rgba(0, 0, 0, 0.5)',
		'--knopf-schatten': '0 8px 22px rgba(242, 194, 48, 0.28)'
	},
	{
		land: '#0e192a', park: '#0f1e2b', wald: '#10202c', wasser: '#060e1a', fluss: '#0c2540', eis: '#15233a',
		siedlung: '#121f36', gebaeude: '#17253c', strasse: '#22334e', strasseKlein: '#1a2941', strasseRand: '#132034',
		grenze: '#34486a', text: '#7d8ca4', textStark: '#d8e0ec', textHalo: '#0a1322', textWasser: '#4d6e9a', relief: 0
	},
	['#f2c230', '#ff8a5c', '#7fd1ae', '#8fb6ff']
);

dunkelVariante(
	'mix-glut',
	'Glut',
	'Warmes Braunschwarz wie am Lagerfeuer, Glut-Orange als Akzent.',
	{
		'--grund': '#14100c',
		'--flaeche': '#1c1712',
		'--flaeche-2': '#272019',
		'--linie': '#352b22',
		'--text': '#f4ede3',
		'--text-2': '#a99b8a',
		'--akzent': '#ef7d3c',
		'--akzent-text': '#190c03',
		'--tief': '#3a2a1b',
		'--signal': '#f2c230',
		'--schatten': '0 -1px 0 #352b22, 0 -14px 36px rgba(0, 0, 0, 0.5)',
		'--knopf-schatten': '0 8px 22px rgba(239, 125, 60, 0.3)'
	},
	{
		land: '#19140f', park: '#1b1911', wald: '#1c1b12', wasser: '#0d1214', fluss: '#1a282c', eis: '#231d17',
		siedlung: '#1f1914', gebaeude: '#251f18', strasse: '#33291f', strasseKlein: '#292119', strasseRand: '#1e1813',
		grenze: '#4a3c2e', text: '#8f8171', textStark: '#e6dbcd', textHalo: '#14100c', textWasser: '#5d7c80', relief: 0
	},
	['#ef7d3c', '#e8bb3e', '#7fbfa8', '#9cc0e8']
);

dunkelVariante(
	'mix-asphalt',
	'Asphalt',
	'Neutrales Graphit, cremeweiße Knöpfe, gelbe Schilder – wie Fahrbahnmarkierung bei Nacht.',
	{
		'--grund': '#111111',
		'--flaeche': '#1a1a19',
		'--flaeche-2': '#242423',
		'--linie': '#323230',
		'--text': '#f5f4ee',
		'--text-2': '#a3a29a',
		'--akzent': '#f1ecdc',
		'--akzent-text': '#111111',
		'--tief': '#2c2c2a',
		'--signal': '#ffd23f',
		'--schatten': '0 -1px 0 #323230, 0 -14px 36px rgba(0, 0, 0, 0.55)',
		'--knopf-schatten': '0 8px 22px rgba(0, 0, 0, 0.5)'
	},
	{
		land: '#161616', park: '#181917', wald: '#191a17', wasser: '#0c0e10', fluss: '#1c2227', eis: '#1f1f1f',
		siedlung: '#1c1c1b', gebaeude: '#232322', strasse: '#3a3a37', strasseKlein: '#2a2a28', strasseRand: '#1b1b1a',
		grenze: '#4a4a46', text: '#8a8983', textStark: '#e9e8e2', textHalo: '#111111', textWasser: '#677c88', relief: 0
	},
	['#ffd23f', '#ff7a4d', '#5ed0c0', '#8fb0ff']
);

export const stilVon = (id: string) => stile.find((s) => s.id === id) ?? stile[0];
