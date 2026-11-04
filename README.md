# Timesheet — Bruynseels Projects

Mobielvriendelijke webapp waarmee arbeiders hun werkdag per werf registreren: datum, werf, begin- en einduur, middagpauze en uitgevoerde werken. De app rekent de gewerkte uren uit en stuurt elke registratie naar een Google Sheet. Een beheerder kan arbeiders en werven beheren, alle registraties bekijken en exporteren.

> Een technische review met bekende bugs, beveiligingsrisico's en een prioriteitenlijst staat in [`docs/REVIEW.md`](docs/REVIEW.md).

## Hoe het werkt

- **Frontend**: één statisch bestand, [`index.html`](index.html) (HTML, CSS en JavaScript, zonder build-stap).
- **Backend**: een Google Apps Script-web-app die een Google Sheet leest en beschrijft. De URL staat bovenaan het script in `index.html` (`SHEET_URL`). De code van het Apps Script zit níét in deze repo.
- **Lokale opslag**: registraties, arbeiders, werven en het admin-wachtwoord worden ook in de `localStorage` van het toestel bewaard. Zo blijft de app bruikbaar als de Sheet even onbereikbaar is.

## Installatie / publiceren

Er hoeft niets geïnstalleerd te worden om de app te draaien: elke statische webhost volstaat.

**GitHub Pages** (meest eenvoudig):
1. Repo → *Settings* → *Pages*.
2. *Source*: "Deploy from a branch", branch `main`, map `/ (root)`.
3. De app staat daarna op `https://<gebruiker>.github.io/Timesheet-Bruynseels-Projects/`.

**Ander adres of eigen hosting**: upload `index.html`. Het bestand is volledig zelfstandig.

### Backend koppelen

1. Maak (of open) het Apps Script dat bij de Google Sheet hoort en publiceer het als **web-app** (*Implementeren* → *Nieuwe implementatie* → *Web-app*, toegang: "Iedereen").
2. Kopieer de `…/exec`-URL en vervang de waarde van `SHEET_URL` in `index.html`.
3. Het script moet deze acties ondersteunen:

| Methode | Actie | Antwoord / inhoud |
|---------|-------|-------------------|
| GET | `?action=workers` | `{ "workers": [{ "naam": "…", "actief": true }] }` |
| GET | `?action=sites` | `{ "sites": [{ "naam": "…", "actief": true }] }` |
| GET | `?action=status` | `{ "today": ["Naam", …] }` (wie vandaag al registreerde) |
| GET | `?action=all&pw=…` | `{ "data": [{ "Name", "Date", "Site", "Start", "End", "Break start", "Break end", "Total hours", "Work performed", "Problems", "Materials needed", "Issues", "Timestamp" }] }` |
| POST | registratie (JSON) | `{ id, naam, datum, werf, start, einde, pauzeStart, pauzeEinde, uren, urenTekst, werken, … }` |
| POST | `{ "action": "addWorker" \| "toggleWorker" \| "deleteWorker" \| "addSite" \| "toggleSite" \| "deleteSite", "naam", "pw"?, "actief"? }` | — |

> ⚠️ **Beveiliging**: het wachtwoord in de app beschermt alleen de interface. Het Apps Script moet zelf het wachtwoord controleren voor `action=all` en alle beheeracties. Gebruik daar **niet** het standaardwachtwoord `admin123`. Zie `docs/REVIEW.md`, §3 en §5.

## Gebruik

**Arbeiders**
1. Open de app en tik op je naam (scherm *Login*). Staat je naam er niet bij, kies dan *➕ Add a name*.
2. Vul op *Register* de datum, werf, uren, middagpauze en de uitgevoerde werken in. Standaard staan de uren op 07:00–17:00 met pauze 12:00–12:30. Velden met een rode rand zijn verplicht.
3. Tik op *Save registration*. Op het loginscherm staat daarna een groene stip bij je naam.

**Beheerder**
1. Ga naar *Admin* en geef het wachtwoord in (standaard `admin123`, **wijzig dit meteen**).
2. Voeg arbeiders en werven toe, verberg ze (✓ Active / ✗ Hidden) of verwijder ze.
3. Onder *Overview* zie je alle registraties uit de Sheet, filterbaar per arbeider. Sheet-registraties pas je aan in de Google Sheet zelf; registraties die alleen op dit toestel staan, kun je hier bewerken of verwijderen.
4. Met ⬇️ (rechtsboven) exporteer je de lokaal bewaarde registraties als CSV (Excel, puntkomma-gescheiden) of als JSON-backup.

**Wachtwoord vergeten?** Het gewijzigde wachtwoord staat per toestel in de browser. Wis de sitegegevens van de pagina (of voer `localStorage.removeItem('wr_pw')` uit in de console); daarna geldt opnieuw het standaardwachtwoord.

## Ontwikkelen

Vereist: [Node.js](https://nodejs.org/) 18 of nieuwer, alleen voor de tests en de lokale server.

Lokaal bekijken op http://localhost:8080:

```bash
npm start
```

Tests draaien (ingebouwde `node:test`, geen extra pakketten nodig):

```bash
npm test
```

De tests (`tests/`) laden het `<script>`-blok uit `index.html` in een minimale nep-DOM en controleren onder meer de urenberekening, de datumverwerking, de HTML-escaping, de CSV-export en het bewaren van het wachtwoord.
