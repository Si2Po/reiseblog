import { describe, it, expect } from 'vitest';
import { vereinfachen } from './vereinfachen.ts';
import type { LngLat } from '#lib/db/typen.ts';

describe('vereinfachen', () => {
	it('behält Start und Ziel und bleibt unter der Höchstzahl', () => {
		const punkte: LngLat[] = Array.from({ length: 5000 }, (_, i) => [8 + i * 0.001, 50 + Math.sin(i / 50) * 0.05]);
		const v = vereinfachen(punkte, 300);
		expect(v.length).toBeLessThanOrEqual(300);
		expect(v[0]).toEqual([8, 50]);
		expect(v.at(-1)![0]).toBeCloseTo(punkte.at(-1)![0], 4);
	});
	it('wirft gerade Strecken auf zwei Punkte zusammen', () => {
		const gerade: LngLat[] = Array.from({ length: 100 }, (_, i) => [10 + i * 0.01, 48]);
		expect(vereinfachen(gerade).length).toBe(2);
	});
});
