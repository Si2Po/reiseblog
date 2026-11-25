# Supabase einrichten (einmalig, ca. 10 Minuten)

Supabase speichert deine Reisen und Fotos online, damit iPhone und PC dasselbe zeigen. Alles ist Ende-zu-Ende verschlüsselt: Supabase sieht nur Datensalat. Der kostenlose Tarif reicht: 500 MB Daten und 1 GB Fotos (etwa 3.000 Fotos in der verkleinerten Größe der App).

## 1. Projekt anlegen
1. Auf https://supabase.com anmelden (mit GitHub geht es am schnellsten).
2. **New project**: Name `reiseblog`, ein Datenbank-Passwort vergeben (gut aufheben, wird aber im Alltag nicht gebraucht), Region **Frankfurt (eu-central-1)**.
   - **GitHub (optional)**: leer lassen. Die Datenbank wird über den SQL Editor eingerichtet (Schritt 2), nicht automatisch beim Push.
   - **Data access**: „Enable Data API“ **an** (die App braucht sie). „Grant API access to new tables automatically“ **aus** lassen (die nötigen Rechte vergibt `komplett.sql` selbst). „Enable RLS on new tables automatically“ **an** (schadet nicht; `komplett.sql` schaltet es ohnehin ein).
3. Warten, bis das Projekt bereit ist (1–2 Minuten).

## 2. Datenbank anlegen
1. Links **SQL Editor** → **New query**.
2. Den kompletten Inhalt von `supabase/komplett.sql` einfügen → **Run**.
3. Es sollte „Success. No rows returned“ erscheinen.

## 3. Anmeldung einstellen
1. Links **Authentication** → **Sign In / Providers** → **Email**.
2. **Confirm email** ausschalten (die App verschickt keine Mails; so kannst du dich direkt anmelden).
3. Speichern.

## 4. Adresse und Schlüssel in die App eintragen
1. Links **Project Settings** → **API Keys** (bzw. **Data API**).
2. Kopieren:
   - die **Project URL** (z. B. `https://abcdefgh.supabase.co`)
   - den **Publishable key** (beginnt mit `sb_publishable_…`; bei älteren Projekten heißt er „anon public“).
3. Beides in `src/lib/config.ts` eintragen (oder Claude geben, dann trägt Claude es ein).

**Niemals** den `service_role`- bzw. Secret-Key oder das Datenbank-Passwort in die App oder ins Repo schreiben. Der Publishable-Key ist dafür gedacht, öffentlich im Code zu stehen.

## 5. Konto anlegen und Verschlüsselung einrichten
1. In der App → Zahnrad → **Konto** → E-Mail und Passwort → **Konto anlegen**.
2. Danach fragt die App nach einem **Tagebuch-Passwort** (nicht dasselbe wie das Anmelde-Passwort). Damit wird alles verschlüsselt.
3. Die App zeigt einmal einen **Notfall-Code**. Sicher aufbewahren (Passwort-Manager oder Ausdruck): Er ist der einzige Weg zurück, falls das Tagebuch-Passwort vergessen wird. Ohne Passwort und Code sind die Daten auf dem Server verloren.
4. Jedes weitere Gerät (z. B. das deiner Partnerin): mit demselben Konto anmelden und einmal das Tagebuch-Passwort eingeben.
5. Danach in Supabase **Authentication → Sign In / Providers** „**Allow new users to sign up**“ ausschalten. Dann kann niemand sonst ein Konto in deinem Projekt anlegen.

## 6. Wecker einschalten
Kostenlose Supabase-Projekte schlafen nach 7 Tagen ohne Nutzung ein. Der GitHub-Ablauf `wecker.yml` ruft die Datenbank deshalb jeden Tag einmal kurz an. Er nimmt Adresse und Schlüssel automatisch aus `src/lib/config.ts`; du musst nichts weiter tun. Prüfen kannst du ihn auf GitHub unter **Actions → Wecker**.

## Später: Änderungen an der Datenbank
Neue Funktionen bringen manchmal eine kleine SQL-Datei in `supabase/schritte/` mit. Die wird genauso im SQL Editor ausgeführt. Welche schon ausgeführt sind:

| Datei | Inhalt | ausgeführt |
|---|---|---|
| `komplett.sql` | Grundausstattung (Dokumente, Freigaben, Fotospeicher, Wecker) | ☑ |
| `schritte/01_verschluesselung.sql` | Verschlüsselung (Tresor, privater Fotospeicher), Teilen entfernt | ☐ |
