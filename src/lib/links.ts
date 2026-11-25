// Links zu Plätzen: erkennen, wohin sie führen, und passend beschriften.

const DIENSTE: { muster: RegExp; name: string }[] = [
	{ muster: /park4night\./i, name: 'Park4Night' },
	{ muster: /campercontact\./i, name: 'Campercontact' },
	{ muster: /pincamp\.|adac\.de/i, name: 'PiNCAMP' },
	{ muster: /eurocampings\.|acsi\./i, name: 'ACSI' },
	{ muster: /camping\.info/i, name: 'camping.info' },
	{ muster: /stellplatz\.info/i, name: 'Stellplatz.info' },
	{ muster: /promobil\./i, name: 'promobil' },
	{ muster: /campspace\./i, name: 'Campspace' },
	{ muster: /hinterland\.camp|alpacacamping\./i, name: 'Alpaca Camping' },
	{ muster: /google\.[a-z.]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl/i, name: 'Google Maps' },
	{ muster: /maps\.apple\.com/i, name: 'Apple Karten' },
	{ muster: /instagram\.com/i, name: 'Instagram' }
];

/** „https://park4night.com/…“ → { name: 'Park4Night', url } */
export function linkInfo(url: string): { name: string; url: string } {
	const d = DIENSTE.find((x) => x.muster.test(url));
	if (d) return { name: d.name, url };
	try {
		return { name: new URL(url).hostname.replace(/^www\./, ''), url };
	} catch {
		return { name: 'Link', url };
	}
}

/** Eingabe säubern: Leerzeichen weg, https:// ergänzen. Leer/ungültig → null. */
export function linkSaeubern(text: string): string | null {
	const t = text.trim();
	if (!t) return null;
	// aus geteiltem Text („Schau mal: https://…“) die Adresse herausziehen
	const gefunden = t.match(/https?:\/\/\S+/i)?.[0] ?? t;
	const url = /^https?:\/\//i.test(gefunden) ? gefunden : 'https://' + gefunden;
	try {
		const u = new URL(url);
		return u.hostname.includes('.') ? u.toString() : null;
	} catch {
		return null;
	}
}
