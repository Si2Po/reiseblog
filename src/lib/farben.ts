// Farben, die nicht als CSS-Variable gehen: Kartenstil und Reisefarben (hell/dunkel).
import type { KartenFarben } from '#lib/map/stil.ts';

export const KARTE_HELL: KartenFarben = {
	land: '#f3f4f0', park: '#e2ecdc', wald: '#dae7d2', wasser: '#c3dde5', fluss: '#b1d1db', eis: '#ffffff',
	siedlung: '#ebece7', gebaeude: '#e3e4df', strasse: '#ffffff', strasseKlein: '#ffffff', strasseRand: '#d6d9d1',
	grenze: '#97a199', text: '#5d6660', textStark: '#18211b', textHalo: '#f6f6f2', textWasser: '#3c7080', relief: 0.18
};

export const KARTE_DUNKEL: KartenFarben = {
	land: '#161616', park: '#181917', wald: '#191a17', wasser: '#0c0e10', fluss: '#1c2227', eis: '#1f1f1f',
	siedlung: '#1c1c1b', gebaeude: '#232322', strasse: '#3a3a37', strasseKlein: '#2a2a28', strasseRand: '#1b1b1a',
	grenze: '#4a4a46', text: '#8a8983', textStark: '#e9e8e2', textHalo: '#111111', textWasser: '#677c88', relief: 0
};

/** Reisefarben: gleiche Reihenfolge hell und dunkel, im Dunkeln heller. */
const REISE_HELL = ['#1d5c3a', '#d9542b', '#2b5da8', '#c99a1e', '#7a3f8c', '#2a8a8a', '#a33b52', '#5a6b1f'];
const REISE_DUNKEL = ['#ffd23f', '#ff7a4d', '#5ed0c0', '#8fb0ff', '#d39be6', '#9bd36a', '#ff8fa8', '#e8c48a'];
export const REISE_ANZAHL = REISE_HELL.length;

export const reiseFarbe = (i: number, dunkel: boolean) => (dunkel ? REISE_DUNKEL : REISE_HELL)[((i % REISE_ANZAHL) + REISE_ANZAHL) % REISE_ANZAHL];
export const reiseFarben = (dunkel: boolean) => (dunkel ? REISE_DUNKEL : REISE_HELL);

/** Fläche für Kartenränder/Halos je Modus */
export const halo = (dunkel: boolean) => (dunkel ? '#1a1a19' : '#ffffff');
