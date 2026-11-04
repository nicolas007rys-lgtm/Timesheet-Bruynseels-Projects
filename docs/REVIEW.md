# Code-review — Timesheet Bruynseels Projects

*Datum: 4 november 2026 · Basis: `main` @ `cf97662` · Branch: `claude/festive-darwin-fv2hbv`*

## 1. Wat doet de app?

Een mobielvriendelijke webpagina waarmee arbeiders van Bruynseels Projects hun werkdag op een werf registreren:

1. **Login** – de arbeider tikt zijn/haar naam aan (geen wachtwoord). Een groene stip toont wie vandaag al registreerde.
2. **Register** – datum, werf, begin- en einduur, middagpauze en een beschrijving van het werk. De app berekent het totaal aantal uren.
3. **Overview** – alleen zichtbaar na admin-login: lijst van alle registraties, filterbaar per arbeider.
4. **Admin** – met wachtwoord: arbeiders en werven toevoegen, verbergen of verwijderen, wachtwoord wijzigen, lokaal loginlog bekijken.
5. **Export** – CSV (puntkomma-gescheiden, voor Excel) en JSON-backup van de lokaal bewaarde registraties.

De gebruikersinterface is Engelstalig, de code (variabelen, commentaar) Nederlandstalig.

## 2. Architectuur

```
Browser (index.html: HTML + CSS + JS in één bestand)
   │  localStorage: registraties, arbeiders, werven, wachtwoord, loginlog
   │
   └── fetch ──► Google Apps Script web-app (SHEET_URL, …/exec)
                    └── Google Sheet (registraties, arbeiders, werven)
```

- **Frontend**: één statisch bestand `index.html` (~850 regels), zonder framework, build-stap of afhankelijkheden (alleen het lettertype Inter van Google Fonts).
- **Backend**: een Google Apps Script-web-app. **De code daarvan zit níét in deze repository.** De frontend gebruikt deze acties:
  - `GET ?action=workers` → `{ workers: [{naam, actief}] }`
  - `GET ?action=sites` → `{ sites: [{naam, actief}] }`
  - `GET ?action=status` → `{ today: ["Naam", …] }`
  - `GET ?action=all&pw=…` → `{ data: [{Name, Date, Site, …}] }`
  - `POST` (JSON, `mode: 'no-cors'`): een registratie, of `{action: addWorker | toggleWorker | deleteWorker | addSite | toggleSite | deleteSite, naam, pw?, actief?}`
- **Opslag**: elke registratie gaat eerst naar `localStorage` van het toestel en daarna (best effort) naar de Sheet. Bewerken en verwijderen gebeurt alleen lokaal.
- **Andere branch**: `claude/calculator-excel-multilang-i3s06r` bevat twee losse Excel-bestanden (calculator NL/FR/EN) en staat los van deze app. Die zijn niet gereviewd.

## 3. Gevonden geheimen en gevoelige gegevens

> Zoals gevraagd is er **niets uit de git-geschiedenis verwijderd**. Hieronder staat wat er gevonden is en wat je best doet.

| # | Wat | Waar | Risico | Aanbevolen actie |
|---|-----|------|--------|------------------|
| G1 | **Standaard admin-wachtwoord `admin123`** in platte tekst | `index.html` (`STANDAARD_PW`), in de geschiedenis sinds de eerste commits | Iedereen die de pagina of de repo opent, kent het wachtwoord. Als het Apps Script hetzelfde wachtwoord controleert, kan iedereen alle registraties opvragen via `?action=all&pw=admin123` en arbeiders/werven verwijderen. | Kies meteen een ander wachtwoord **in het Apps Script** (server). Zie ook B1: de wijzigfunctie in de app werkte niet. |
| G2 | **Huidige Apps Script-URL** (`…/AKfycbzOk3Ep…/exec`) | `index.html` (`SHEET_URL`) | Geen wachtwoord, maar wel een publiek eindpunt zonder authenticatie: iedereen die de URL kent, kan registraties en arbeiders/werven toevoegen (spam, valse uren). | Aanvaardbaar voor een interne tool **als** het script alle invoer valideert en beheeracties met een sterk wachtwoord beveiligt. Repo eventueel privé zetten. |
| G3 | **Oude Apps Script-URL** (`…/AKfycbwtWtT8…/exec`) | Alleen in de git-geschiedenis (vroege commits) | Als die oude implementatie nog actief is, draait er een tweede, misschien onbeveiligde ingang naar dezelfde Sheet. | In Apps Script → *Implementaties beheren* nagaan of die implementatie nog bestaat, en zo ja **archiveren**. |
| G4 | **Voornamen van arbeiders en adressen van werven** | `VASTE_AANNEMERS`, `VASTE_WERVEN` | Persoonsgegevens (GDPR) en klantadressen in een (mogelijk publieke) repo. | Lijsten alleen in de Sheet bijhouden, of de repo privé zetten. |

Er zijn geen API-sleutels, tokens of andere wachtwoorden gevonden (gezocht in de volledige geschiedenis van alle branches).

## 4. Bugs

### Opgelost in deze branch

| # | Bug | Gevolg voor gebruikers | Oplossing | Merkbare gedragswijziging & verantwoording |
|---|-----|------------------------|-----------|--------------------------------------------|
| **B1** | Wachtwoord wijzigen werkte niet. `laadData()` geeft de fallback terug zodra de opgeslagen waarde geen niet-lege array is, en een wachtwoord is een string. Na elke herlaadbeurt was het wachtwoord dus weer `admin123`. | De admin dacht dat het wachtwoord gewijzigd was ("✅ Password changed!"), maar `admin123` bleef werken. | Nieuwe functie `laadTekst()` voor tekstwaarden. | **Ja.** Een gewijzigd wachtwoord blijft nu echt bewaard, zoals de knop belooft. ⚠️ Toestellen waarop vroeger een ander wachtwoord is ingesteld, vragen nu *dat* wachtwoord. Vergeten? Wis de sitegegevens van de pagina (of `localStorage.removeItem('wr_pw')` in de console); daarna geldt `admin123` weer. Let op: dit wachtwoord blijft per toestel en beschermt alleen de interface (zie S2). |
| **B2** | **HTML/script-injectie (stored XSS).** Namen, werven, beschrijvingen enz. kwamen ongefilterd in `innerHTML`. Iedereen kan via "Add a name" of "Add new site" een naam toevoegen, die naar de Sheet gaat en op **alle** toestellen getoond wordt, ook bij de admin. | Een kwaadwillige (of per ongeluk geplakte) naam als `<img src=x onerror=…>` kon code uitvoeren op elk toestel, bv. het admin-wachtwoord stelen. | Functie `esc()`; alle dynamische waarden in `innerHTML` en attributen worden nu ge-escaped. | Nauwelijks: tekst met `<`, `>` of `&` verschijnt nu letterlijk in plaats van als HTML. Gewone namen zien er hetzelfde uit. |
| **B3** | **Edit/Delete in de admin-overview crashte** voor registraties uit de Sheet. Die krijgen id `sheet_0`, `sheet_1`, …, waardoor `onclick="openEdit(sheet_0)"` een JavaScript-fout gaf. Ook met een geldig id zocht `openEdit` alleen in de lokale lijst. | Knoppen deden niets. | Edit/Delete verschijnen alleen nog bij lokaal bewaarde registraties. Toont de admin-view Sheet-data, dan staat er "(read-only: edit them in the Google Sheet)" bij. | **Ja.** Kapotte knoppen bij Sheet-rijen zijn weg en vervangen door een duidelijke melding. Bewerken via de Sheet zelf was al de enige werkende manier. |
| **B4** | `vandaag()` gebruikte `toISOString()`, dus de **UTC-datum**. In België (UTC+1/+2) gaf dat tussen middernacht en 01:00/02:00 de datum van gisteren. | Verkeerde standaarddatum bij registraties kort na middernacht. | Lokale datum via `lokaleDatum()`. | Alleen in dat tijdvenster: de datum klopt nu. |
| **B5** | Datums uit de Sheet werden ingekort met `String(date).slice(0,10)`. Apps Script stuurt datumcellen als UTC-tijdstempel (bv. `2026-06-24T22:00:00.000Z` voor 25/06 in België). | In de admin-overview stond elke Sheet-registratie **één dag te vroeg**. | `normaliseerSheetDatum()` zet een tijdstempel om naar de lokale kalenderdatum. Gewone `JJJJ-MM-DD`-tekst blijft ongewijzigd. | **Ja.** Datums in de overview kloppen nu. (Stuurt het script al tekst, dan verandert er niets.) |
| **B6** | Een pauze die om `00:00` begint of eindigt, werd genegeerd: `tijdNaarMinuten('00:00')` is `0`, en dat is *falsy*. | Te veel uren in dat (zeldzame) geval. | Expliciete `!== null`-controle. | Alleen in dat randgeval. |
| **B7** | `uren: Math.round(totalMin)/60` rondde niets af (minuten zijn al geheel), dus 9u20 werd `9.333333333333334`. | Lange kommagetallen in de Sheet/JSON. | Afgerond op 2 decimalen (`9.33`). | Alleen de numerieke kolom `uren`. De tekst `urenTekst` (`9h20`) blijft hetzelfde. |
| **B8** | CSV-export zette naam, werf en tijden niet tussen aanhalingstekens. Een werfnaam met `;` (bv. "Straat 5; achterbouw") verschoof alle kolommen. | Kapotte Excel-export. | Alle velden worden nu gequote via `csvVeld()`. | Geen zichtbaar verschil in Excel. |

### Gevonden maar níét opgelost (vergen een keuze of serverwijziging)

| # | Probleem | Waarom niet opgelost |
|---|----------|----------------------|
| B9 | **"✅ Saved to Google Sheet!" verschijnt ook als het opslaan mislukt.** Door `mode: 'no-cors'` kan de app het antwoord niet lezen; `fetch` faalt alleen bij een netwerkfout. | Vergt CORS-ondersteuning of een andere aanpak in het Apps Script (bv. `Content-Type: text/plain` + JSON-antwoord). |
| B10 | **Geen herpoging bij offline opslaan.** Een registratie zonder netwerk staat alleen lokaal en gaat nooit alsnog naar de Sheet. Op een werf met slecht bereik gaat zo data verloren voor de admin. | Vergt een wachtrij plus duplicaatdetectie (het `id` is er al) aan serverkant. |
| B11 | Bewerken en verwijderen (admin) gebeurt **alleen lokaal** en wordt niet naar de Sheet gesynchroniseerd. | Vergt nieuwe acties (`updateRegistration`, `deleteRegistration`) in het script. |
| B12 | De pauze wordt afgetrokken, ook als ze buiten de werkuren valt (bv. werken 13:00–17:00 met pauze 12:00–12:30 geeft 3u30). | Alleen de overlap aftrekken is waarschijnlijk correcter, maar verandert de berekening. Te bevestigen door de zaakvoerder. |
| B13 | Nachtwerk (einde na middernacht) kan niet geregistreerd worden. | Functionele keuze. |
| B14 | Begin- en einduren uit de Sheet kunnen als tijdstempel (`1899-12-30T…`) binnenkomen als de cellen als tijd zijn opgemaakt. | Hangt af van het (ontbrekende) Apps Script. Omzetten in de browser is foutgevoelig door historische tijdzone-offsets; beter in het script met `Utilities.formatDate`. |
| B15 | De CSV-export bevat alleen de **lokale** registraties van dit toestel, ook in de admin-view met Sheet-data. | Is "Excel-export" de bedoeling, dan is de Sheet zelf de bron. Te bevestigen. |
| B16 | "Add new site" toont "✅ … added", ook als de werf al bestond. | Cosmetisch. |

## 5. Beveiligingsrisico's

| # | Risico | Ernst | Toelichting |
|---|--------|-------|-------------|
| S1 | Stored XSS via namen/werven | **Hoog** → **opgelost** (B2) | Zie B2. |
| S2 | Admin-controle gebeurt alleen in de browser | **Hoog** | `checkAdmin()` vergelijkt met een waarde in de broncode of `localStorage`. Met de devtools (`isAdmin = true`) omzeil je dat. Echte bescherming kan alleen in het Apps Script, dat bij elke beheeractie het wachtwoord moet controleren. Dat script zit niet in de repo en is dus niet gecontroleerd. |
| S3 | Standaardwachtwoord publiek (G1) | **Hoog** | Zie G1. |
| S4 | Wachtwoord in de URL (`?action=all&pw=…`) | Middel | Komt terecht in de browsergeschiedenis en in de logs van Google. Beter via `POST`-body. |
| S5 | Iedereen kan arbeiders en werven toevoegen (`addWorker`/`addSite` vanuit login- en registratiescherm, zonder wachtwoord) | Middel | Zo bedoeld ("Iedereen kan…"), maar het opent de deur voor spam. Het script moet lengte en tekens beperken en duplicaten weigeren. |
| S6 | Geen invoervalidatie aan serverkant zichtbaar | Middel | Lengte van tekstvelden, geldige datum/tijd, bestaande arbeider/werf: allemaal alleen in de browser of helemaal niet. Ook **CSV/formula-injectie**: tekst die begint met `=`, `+`, `-` of `@` kan in Excel/Sheets als formule uitgevoerd worden. Aanbeveling: in het script zulke waarden voorafgaan door `'`. |
| S7 | Geen identiteitscontrole van arbeiders | Laag/aanvaard | Iedereen kan op elke naam tikken en uren invoeren voor een ander. Voor een interne werftool mogelijk aanvaardbaar. |
| S8 | `maximum-scale=1.0` in de viewport | Laag (toegankelijkheid) | Inzoomen is geblokkeerd voor slechtzienden. Niet gewijzigd: dat verandert het gedrag op de gsm. |

## 6. Onderhoudbaarheid

- **Alles in één bestand** met erg compacte code (meerdere statements per regel, korte namen). Leesbaar voor de auteur, moeilijk voor anderen. Splitsen in `index.html` + `app.js` + `style.css` is een logische volgende stap. In deze branch is dat bewust **niet** gedaan, zodat de manier van publiceren (één bestand uploaden) niet breekt.
- **Backend ontbreekt in de repo.** Het Apps Script hoort in versiebeheer (bv. `apps-script/Code.gs`, eventueel met [`clasp`](https://github.com/google/clasp)), anders is de helft van het systeem niet te reviewen of te herstellen.
- **Commitberichten** zijn bijna allemaal "Update index.html" of misleidend ("Update print statement from 'Hello' to 'Goodbye'"). Beschrijvende berichten maken de geschiedenis bruikbaar.
- **Duplicatie**: dezelfde `fetch(SHEET_URL,{method:'POST',mode:'no-cors',…})` staat 8 keer in de code. Eén helper `postNaarSheet(payload)` zou dat oplossen. De zes beheerfuncties voor arbeiders en werven zijn bijna identiek.
- **Gemengde taal**: UI in het Engels, code in het Nederlands, `toLocaleString('nl-BE')` in het loginlog. Een bewuste keuze maken (de andere branch wijst op NL/FR/EN).
- **Dode code**: CSS voor `.tag.problem`/`.material` en de velden `problems`, `materials`, `issues` worden nog getoond en bewerkt, maar niet meer ingevuld bij registratie (sinds commit `cf97662`).
- **Tests**: er waren er geen. Nu is er een testsuite zonder afhankelijkheden (`npm test`, Node ≥ 18) die het script uit `index.html` laadt in een nep-DOM.

## 7. Prioriteitenlijst

| Prio | Actie | Wie | Status |
|------|-------|-----|--------|
| 🔴 1 | Admin-wachtwoord in het **Apps Script** wijzigen (weg van `admin123`) en daar bij élke beheer- en leesactie controleren | Eigenaar Apps Script | Open |
| 🔴 2 | Oude Apps Script-implementatie (`AKfycbwtWtT8…`) archiveren als die nog bestaat (G3) | Eigenaar Apps Script | Open |
| 🔴 3 | XSS dichten (B2) | — | ✅ Deze PR |
| 🔴 4 | Wachtwoordwijziging die echt bewaard blijft (B1) | — | ✅ Deze PR |
| 🟠 5 | Apps Script-code in de repo zetten + invoervalidatie en formula-injectiebescherming (S5, S6) | Ontwikkelaar | Open |
| 🟠 6 | Betrouwbaar opslaan: echte bevestiging (B9) en wachtrij voor offline registraties (B10) | Ontwikkelaar | Open |
| 🟠 7 | Datumfouten (B4, B5), Edit/Delete-crash (B3), CSV (B8), uren (B6, B7) | — | ✅ Deze PR |
| 🟡 8 | Repo privé zetten of namen/adressen uit de broncode halen (G4) | Eigenaar | Open |
| 🟡 9 | Wachtwoord via POST i.p.v. URL (S4) | Ontwikkelaar | Open |
| 🟡 10 | Bewerken/verwijderen naar de Sheet synchroniseren (B11) | Ontwikkelaar | Open |
| 🟢 11 | Pauzeberekening bij overlap (B12), nachtwerk (B13), CSV-bron (B15) | Zaakvoerder beslist | Open |
| 🟢 12 | Code opsplitsen, `postNaarSheet`-helper, dode velden opruimen, beschrijvende commits | Ontwikkelaar | Open |
