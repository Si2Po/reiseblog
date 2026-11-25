/*
  Ende-zu-Ende-Verschlüsselung („Tresor“).

  - Alle Daten werden auf dem Gerät mit einem zufälligen Tagebuch-Schlüssel (AES-GCM, 256 Bit)
    verschlüsselt, bevor sie zu Supabase gehen – Inhalte von Einträgen, Reisen, Plätzen, Zielen,
    Fotos samt Vorschau. Der Server sieht nur: Art, Anzahl, Zeitpunkte, Dateigrößen.
  - Der Tagebuch-Schlüssel liegt auf dem Server nur „eingepackt“ (Tabelle `tresor`):
      · mit dem Tagebuch-Passwort (PBKDF2-SHA-256, 600 000 Runden, eigenes Salz)
      · mit dem Notfall-Code (25 Zeichen, ebenso abgeleitet)
    Das Tagebuch-Passwort ist NICHT das Anmelde-Passwort und verlässt das Gerät nie.
  - Jedes Gerät braucht das Passwort (oder den Code) einmal; danach liegt der Schlüssel lokal in
    IndexedDB (`meta`, „tresor“) und wird beim Abmelden gelöscht.
  - Passwort oder Code vergessen UND kein Gerät mehr entsperrt = Daten auf dem Server verloren.
*/
import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from './db.ts';

const RUNDEN = 600_000;
const ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O, 1/I – gut abzutippen

export interface Paket {
	iv: string;
	d: string;
}
interface TresorZeile {
	salz: string;
	pw: Paket;
	code_salz: string;
	code: Paket;
}

// --- kleine Helfer ---
const text = new TextEncoder();
function b64(buf: ArrayBuffer | Uint8Array): string {
	const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let s = '';
	for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
	return btoa(s);
}
function unb64(s: string): Uint8Array<ArrayBuffer> {
	const bin = atob(s);
	const u = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
	return u;
}
const zufall = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function ableiten(geheim: string, salz: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
	const basis = await crypto.subtle.importKey('raw', text.encode(geheim.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
	return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salz, iterations: RUNDEN, hash: 'SHA-256' }, basis, { name: 'AES-GCM', length: 256 }, false, [
		'encrypt',
		'decrypt'
	]);
}
async function einpacken(schluessel: CryptoKey, daten: BufferSource): Promise<Paket> {
	const iv = zufall(12);
	const d = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, schluessel, daten);
	return { iv: b64(iv), d: b64(d) };
}
async function auspacken(schluessel: CryptoKey, p: Paket): Promise<ArrayBuffer> {
	return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, schluessel, unb64(p.d));
}
const rohImport = (roh: BufferSource) => crypto.subtle.importKey('raw', roh, 'AES-GCM', true, ['encrypt', 'decrypt']);

/** Notfall-Code: 25 Zeichen (≈ 125 Bit), in Fünfergruppen */
function neuerCode(): string {
	const z = zufall(25);
	const roh = [...z].map((x) => ZEICHEN[x % ZEICHEN.length]).join('');
	return roh.match(/.{5}/g)!.join('-');
}
/** Eingabe vereinheitlichen: Groß, ohne Leer-/Bindestriche, verwechselbare Zeichen korrigiert */
export const codeSaeubern = (s: string) =>
	s
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.replace(/0/g, 'O')
		.replace(/1/g, 'I');
const istCode = (s: string) => codeSaeubern(s).length === 25 && /^[A-Z2-9]+$/.test(codeSaeubern(s));

export type TresorStatus = 'aus' | 'pruefen' | 'einrichten' | 'entsperren' | 'offen';

class Tresor {
	status = $state<TresorStatus>('aus');
	#schluessel: CryptoKey | null = null;
	#uid: string | null = null;

	get offen() {
		return this.status === 'offen' && !!this.#schluessel;
	}

	/** Nach der Anmeldung: lokalen Schlüssel suchen, sonst schauen, ob es auf dem Server schon einen Tresor gibt */
	async pruefen(c: SupabaseClient, uid: string) {
		this.#uid = uid;
		const lokal = (await db.meta.get('tresor'))?.wert as { uid: string; schluessel: CryptoKey } | undefined;
		if (lokal?.uid === uid && lokal.schluessel) {
			this.#schluessel = lokal.schluessel;
			this.status = 'offen';
			return;
		}
		this.status = 'pruefen';
		const zeile = await this.#zeile(c);
		this.status = zeile ? 'entsperren' : 'einrichten';
	}

	async #zeile(c: SupabaseClient): Promise<TresorZeile | null> {
		const { data, error } = await c.from('tresor').select('salz, pw, code_salz, code').maybeSingle();
		if (error) throw error;
		return data as TresorZeile | null;
	}

	async #merken(schluessel: CryptoKey) {
		this.#schluessel = schluessel;
		await db.meta.put({ schluessel: 'tresor', wert: { uid: this.#uid, schluessel } });
		this.status = 'offen';
	}

	/** Erstes Gerät: Schlüssel erzeugen, mit Passwort und Notfall-Code einpacken. Gibt den Code zurück (nur jetzt sichtbar!). */
	async einrichten(c: SupabaseClient, passwort: string): Promise<string> {
		const roh = zufall(32);
		const code = neuerCode();
		const salz = zufall(16),
			codeSalz = zufall(16);
		const zeile: TresorZeile = {
			salz: b64(salz),
			pw: await einpacken(await ableiten(passwort, salz), roh),
			code_salz: b64(codeSalz),
			code: await einpacken(await ableiten(codeSaeubern(code), codeSalz), roh)
		};
		const { error } = await c.from('tresor').insert(zeile);
		if (error) {
			if (/duplicate|unique|23505/i.test(error.message + (error as { code?: string }).code)) {
				this.status = 'entsperren';
				throw new Error('Auf einem anderen Gerät wurde die Verschlüsselung gerade eingerichtet – bitte mit dem Tagebuch-Passwort entsperren.');
			}
			throw error;
		}
		await this.#merken(await rohImport(roh));
		return code;
	}

	/** Weiteres Gerät: mit Tagebuch-Passwort oder Notfall-Code entsperren. Gibt zurück, womit es geklappt hat. */
	async entsperren(c: SupabaseClient, eingabe: string): Promise<'passwort' | 'code'> {
		const zeile = await this.#zeile(c);
		if (!zeile) throw new Error('Auf dem Server gibt es noch keinen Tresor.');
		const versuche: ['passwort' | 'code', string, string, Paket][] = [['passwort', eingabe, zeile.salz, zeile.pw]];
		if (istCode(eingabe)) versuche.unshift(['code', codeSaeubern(eingabe), zeile.code_salz, zeile.code]);
		for (const [art, geheim, salz, paket] of versuche) {
			try {
				const roh = await auspacken(await ableiten(geheim, unb64(salz)), paket);
				await this.#merken(await rohImport(roh));
				return art;
			} catch {
				/* nächster Versuch */
			}
		}
		throw new Error('Das passt nicht – weder als Tagebuch-Passwort noch als Notfall-Code.');
	}

	/** Neues Tagebuch-Passwort (Schlüssel bleibt gleich, nur neu eingepackt) */
	async passwortAendern(c: SupabaseClient, neu: string) {
		const roh = await this.#roh();
		const salz = zufall(16);
		const { error } = await c
			.from('tresor')
			.update({ salz: b64(salz), pw: await einpacken(await ableiten(neu, salz), roh) })
			.eq('owner', this.#uid!);
		if (error) throw error;
	}

	/** Neuer Notfall-Code (der alte gilt danach nicht mehr) */
	async codeErneuern(c: SupabaseClient): Promise<string> {
		const roh = await this.#roh();
		const code = neuerCode();
		const salz = zufall(16);
		const { error } = await c
			.from('tresor')
			.update({ code_salz: b64(salz), code: await einpacken(await ableiten(codeSaeubern(code), salz), roh) })
			.eq('owner', this.#uid!);
		if (error) throw error;
		return code;
	}

	async #roh(): Promise<ArrayBuffer> {
		if (!this.#schluessel) throw new Error('Tresor ist nicht entsperrt.');
		return crypto.subtle.exportKey('raw', this.#schluessel);
	}

	/** Beim Abmelden: Schlüssel von diesem Gerät entfernen */
	async vergessen() {
		this.#schluessel = null;
		this.#uid = null;
		this.status = 'aus';
		await db.meta.delete('tresor');
	}

	// --- Verschlüsseln für den Abgleich ---
	async datensatz(wert: unknown): Promise<Paket & { v: 1 }> {
		if (!this.#schluessel) throw new Error('Tresor ist nicht entsperrt.');
		return { v: 1, ...(await einpacken(this.#schluessel, text.encode(JSON.stringify(wert)))) };
	}
	async datensatzLesen<T>(p: Paket): Promise<T> {
		if (!this.#schluessel) throw new Error('Tresor ist nicht entsperrt.');
		try {
			return JSON.parse(new TextDecoder().decode(await auspacken(this.#schluessel, p)));
		} catch {
			throw new Error('Daten vom Server lassen sich nicht entschlüsseln.');
		}
	}
	/** Datei: 12 Byte IV + verschlüsselte Bytes */
	async datei(bytes: ArrayBuffer): Promise<Uint8Array> {
		if (!this.#schluessel) throw new Error('Tresor ist nicht entsperrt.');
		const iv = zufall(12);
		const d = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.#schluessel, bytes));
		const out = new Uint8Array(12 + d.length);
		out.set(iv);
		out.set(d, 12);
		return out;
	}
	async dateiLesen(bytes: ArrayBuffer): Promise<ArrayBuffer> {
		if (!this.#schluessel) throw new Error('Tresor ist nicht entsperrt.');
		const u = new Uint8Array(bytes);
		return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, this.#schluessel, u.slice(12));
	}
}

export const tresor = new Tresor();
