/*
  Verbindung zu Supabase. Beides darf öffentlich im Code stehen (Publishable-Key, geschützt über Row Level Security).
  Niemals den Secret-/service_role-Key hier eintragen!
  Leer = Abgleich aus, die App speichert nur auf dem Gerät.
  Anleitung: supabase/ANLEITUNG.md
  (Die beiden Zeilen werden auch vom Wecker-Ablauf gelesen – Format beibehalten.)
*/
export const SUPABASE_URL = '';
export const SUPABASE_KEY = '';

// Nur für automatische Tests (tools/abgleich-test.mjs): nachgebaute Supabase über Umgebungsvariablen
const TEST_URL = import.meta.env.VITE_TEST_SUPABASE_URL as string | undefined;
export const DB_URL = TEST_URL || SUPABASE_URL;
export const DB_KEY = TEST_URL ? 'test-schluessel' : SUPABASE_KEY;

/** Adressen, unter denen diese Datenbank benutzt werden darf (Kopien der App woanders laufen nur auf dem Gerät) */
const ERLAUBT = ['si2po.github.io', 'localhost', '127.0.0.1'];

export const abgleichMoeglich = () =>
	!!DB_URL && !!DB_KEY && (ERLAUBT.includes(location.hostname) || /^192\.168\./.test(location.hostname));
