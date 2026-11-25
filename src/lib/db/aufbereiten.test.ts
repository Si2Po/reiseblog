import { describe, it, expect } from 'vitest';
import { aufbereiten } from './aufbereiten.ts';
import type { Eintrag, Platz } from './typen.ts';

describe('aufbereiten', () => {
	it('wandelt alte Plätze in Merkmale und Links um', () => {
		const alt = { id: 'p', geaendert: 1, name: 'X', art: 'camping', ort: { lat: 1, lng: 2 }, ausstattung: ['strom', 'hunde'], untergrund: 'Schotter', url: 'https://park4night.com/de/place/1' };
		const neu = aufbereiten('plaetze', alt as unknown as Platz);
		expect(neu.merkmale).toEqual({ strom: true, hunde: true, untergrund: 'schotter' });
		expect(neu.links).toEqual(['https://park4night.com/de/place/1']);
		expect('ausstattung' in neu).toBe(false);
	});
	it('legt unbekannten Untergrund in die Notiz', () => {
		const neu = aufbereiten('plaetze', { id: 'p', geaendert: 1, name: 'X', art: 'camping', ort: { lat: 1, lng: 2 }, untergrund: 'Lehm', notiz: 'schön' } as unknown as Platz);
		expect(neu.notiz).toBe('schön\nUntergrund: Lehm');
	});
	it('macht aus dem Text einer Übernachtung die erste Notiz und entfernt „privat“', () => {
		const neu = aufbereiten('eintraege', { id: 'e', geaendert: 1, reise: 'r', typ: 'stay', titel: 'T', datum: '2025-07-05', text: 'super', privat: true } as unknown as Eintrag);
		expect(neu.notizen?.[0]).toMatchObject({ zeit: '2025-07-05T20:00', text: 'super' });
		expect(neu.text).toBeUndefined();
		expect('privat' in neu).toBe(false);
	});
	it('macht aus einem Event einen Ausflug und behält den Text', () => {
		const neu = aufbereiten('eintraege', { id: 'e', geaendert: 1, reise: 'r', typ: 'event', titel: 'Weinfest', datum: '2025-07-05', text: 'lustig' } as unknown as Eintrag);
		expect(neu).toMatchObject({ typ: 'outing', titel: 'Weinfest', text: 'lustig' });
	});
	it('lässt aktuelle Daten unverändert (gleiches Objekt)', () => {
		const p = { id: 'p', geaendert: 1, name: 'X', art: 'camping', ort: { lat: 1, lng: 2 }, merkmale: {}, links: [] } as unknown as Platz;
		expect(aufbereiten('plaetze', p)).toBe(p);
	});
});
