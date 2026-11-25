import { describe, it, expect } from 'vitest';
import { viaEinfuegen } from './routen.ts';

const p = (name: string, lat: number, lng: number) => ({ name, lat, lng });
const sipplingen = p('Sipplingen', 47.796, 9.097);
const ravensburg = p('Ravensburg', 47.782, 9.611);
const memmingen = p('Memmingen', 47.987, 10.181);
const erding = p('Erding', 48.306, 11.907);

describe('viaEinfuegen', () => {
	it('setzt den ersten Zwischenhalt zwischen Start und Ziel', () => {
		expect(viaEinfuegen(sipplingen, [], erding, ravensburg).map((x) => x.name)).toEqual(['Ravensburg']);
	});
	it('fügt einen weiteren Halt an der passenden Stelle ein', () => {
		expect(viaEinfuegen(sipplingen, [memmingen], erding, ravensburg).map((x) => x.name)).toEqual(['Ravensburg', 'Memmingen']);
		expect(viaEinfuegen(sipplingen, [ravensburg], erding, memmingen).map((x) => x.name)).toEqual(['Ravensburg', 'Memmingen']);
	});
});
