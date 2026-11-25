/*
  Wetter zum Reisetag (Open-Meteo, kostenlos, ohne Schlüssel – gesendet werden nur Koordinaten und Datum).
  Für jeden vergangenen Tag gibt es einen „Ort des Tages“: die Übernachtung dieser Nacht, sonst der
  letzte Eintrag des Tages mit Ort. Das Wetter wird an diesem Eintrag gespeichert (`wetter[datum]`) und
  reist so beim Abgleich mit. Nachgetragen wird still beim Öffnen einer Reise.
*/
import type { Component } from 'svelte';
import Sun from 'phosphor-svelte/lib/Sun';
import CloudSun from 'phosphor-svelte/lib/CloudSun';
import Cloud from 'phosphor-svelte/lib/Cloud';
import CloudFog from 'phosphor-svelte/lib/CloudFog';
import CloudRain from 'phosphor-svelte/lib/CloudRain';
import CloudSnow from 'phosphor-svelte/lib/CloudSnow';
import CloudLightning from 'phosphor-svelte/lib/CloudLightning';
import { daten } from '#lib/db/daten.svelte.ts';
import { tage, type Tag } from '#lib/auswertung.ts';
import { heute, plusTage } from '#lib/datum.ts';
import type { Eintrag, Ort, Wetter } from '#lib/db/typen.ts';

/** WMO-Wettercode → Symbol und kurzer Text */
export function wetterArt(c: number): { icon: Component; name: string } {
	if (c === 0) return { icon: Sun, name: 'Sonnig' };
	if (c <= 2) return { icon: CloudSun, name: 'Heiter' };
	if (c === 3) return { icon: Cloud, name: 'Bedeckt' };
	if (c === 45 || c === 48) return { icon: CloudFog, name: 'Nebel' };
	if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { icon: CloudSnow, name: 'Schnee' };
	if (c >= 95) return { icon: CloudLightning, name: 'Gewitter' };
	if (c >= 51) return { icon: CloudRain, name: c <= 57 ? 'Niesel' : 'Regen' };
	return { icon: Cloud, name: 'Bewölkt' };
}

/** Eintrag, der für diesen Tag den Ort angibt (und an dem das Wetter steht) */
export function tagesEintrag(t: Tag): Eintrag | undefined {
	const nacht = t.eintraege.find((e) => e.typ === 'stay' && e.ort) ?? t.naechte[0]?.eintrag;
	if (nacht?.ort) return nacht;
	return t.eintraege.filter((e) => e.ort || e.nach).at(-1);
}

const ortVon = (e: Eintrag): Ort | undefined => (e.typ === 'drive' ? (e.nach ?? e.von) : e.ort);

export function tagesWetter(t: Tag): Wetter | undefined {
	return tagesEintrag(t)?.wetter?.[t.datum];
}

const erledigt = new Set<string>();

/** Fehlendes Wetter vergangener Tage einer Reise nachtragen (still, einmal pro Sitzung und Reise) */
export async function wetterNachtragen(reise: string) {
	if (erledigt.has(reise) || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
	erledigt.add(reise);
	const h = heute();
	// je Eintrag die Tage ohne Wetter sammeln
	const offen = new Map<string, string[]>();
	for (const t of tage(reise)) {
		if (t.datum >= h) continue; // nur abgeschlossene Tage
		const e = tagesEintrag(t);
		if (!e || !ortVon(e) || e.wetter?.[t.datum]) continue;
		offen.set(e.id, [...(offen.get(e.id) ?? []), t.datum]);
	}
	for (const [id, daten_] of offen) {
		const e = daten.eintrag(id);
		const o = e && ortVon(e);
		if (!e || !o) continue;
		try {
			const neu = await holen(o, daten_);
			if (!Object.keys(neu).length) continue;
			const aktuell = daten.eintrag(id);
			if (aktuell) await daten.speichern('eintraege', { ...aktuell, wetter: { ...(aktuell.wetter ?? {}), ...neu } });
		} catch {
			erledigt.delete(reise); // später nochmal versuchen
			return;
		}
	}
}

/** Tageswerte für einen Ort; ältere Tage aus dem Archiv, die letzten Tage aus der Vorhersage-Schnittstelle */
async function holen(o: Ort, tage_: string[]): Promise<Record<string, Wetter>> {
	const grenze = plusTage(heute(), -6);
	const alt = tage_.filter((d) => d < grenze);
	const neu = tage_.filter((d) => d >= grenze);
	const ergebnis: Record<string, Wetter> = {};
	for (const [liste, basis] of [
		[alt, 'https://archive-api.open-meteo.com/v1/archive'],
		[neu, 'https://api.open-meteo.com/v1/forecast']
	] as const) {
		if (!liste.length) continue;
		const start = liste.reduce((a, b) => (a < b ? a : b));
		const ende = liste.reduce((a, b) => (a > b ? a : b));
		const url =
			`${basis}?latitude=${o.lat.toFixed(3)}&longitude=${o.lng.toFixed(3)}&start_date=${start}&end_date=${ende}` +
			'&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto';
		const r = await fetch(url);
		if (!r.ok) throw new Error('Wetter ' + r.status);
		const d = (await r.json())?.daily;
		if (!d?.time) continue;
		d.time.forEach((tag: string, i: number) => {
			if (!liste.includes(tag) || d.weather_code[i] === null || d.temperature_2m_max[i] === null) return;
			ergebnis[tag] = {
				c: d.weather_code[i],
				max: Math.round(d.temperature_2m_max[i]),
				min: Math.round(d.temperature_2m_min[i]),
				regen: d.precipitation_sum[i] ? Math.round(d.precipitation_sum[i] * 10) / 10 : undefined
			};
		});
	}
	return ergebnis;
}
