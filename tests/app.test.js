'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadApp } = require('./harness');

test('berekenTotaal: normale dag met middagpauze', () => {
  const { app } = laadApp();
  assert.equal(app.berekenTotaal('07:00', '17:00', '12:00', '12:30'), 570);
});

test('berekenTotaal: einde vóór of gelijk aan start geeft null', () => {
  const { app } = laadApp();
  assert.equal(app.berekenTotaal('17:00', '07:00', '', ''), null);
  assert.equal(app.berekenTotaal('08:00', '08:00', '', ''), null);
  assert.equal(app.berekenTotaal('', '08:00', '', ''), null);
});

test('berekenTotaal: pauze die om 00:00 begint wordt niet genegeerd', () => {
  const { app } = laadApp();
  // Nachtwerk binnen één kalenderdag is niet mogelijk, maar de pauzelogica mag 00:00 niet als "leeg" zien.
  assert.equal(app.berekenTotaal('00:00', '04:00', '00:00', '00:30'), 210);
});

test('berekenTotaal: ongeldige pauze (einde vóór start) wordt genegeerd', () => {
  const { app } = laadApp();
  assert.equal(app.berekenTotaal('07:00', '15:00', '12:30', '12:00'), 480);
});

test('minutenNaarTekst', () => {
  const { app } = laadApp();
  assert.equal(app.minutenNaarTekst(570), '9h30');
  assert.equal(app.minutenNaarTekst(480), '8h');
  assert.equal(app.minutenNaarTekst(65), '1h05');
  assert.equal(app.minutenNaarTekst(0), '—');
  assert.equal(app.minutenNaarTekst(null), '—');
});

test('formatDatum en initialen', () => {
  const { app } = laadApp();
  assert.equal(app.formatDatum('2026-06-25'), '25/06/2026');
  assert.equal(app.formatDatum(''), '');
  assert.equal(app.initialen('Jan Peeters'), 'JP');
  assert.equal(app.initialen('Adam'), 'A');
});

test('vandaag() gebruikt de lokale kalenderdatum, niet UTC', () => {
  const { app } = laadApp();
  // 00:30 lokale tijd: toISOString() zou in UTC+1/+2 nog "gisteren" geven.
  const d = new Date(2026, 5, 25, 0, 30);
  assert.equal(app.lokaleDatum(d), '2026-06-25');
  const nu = new Date();
  const verwacht = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, '0')}-${String(nu.getDate()).padStart(2, '0')}`;
  assert.equal(app.vandaag(), verwacht);
});

test('normaliseerSheetDatum: zet UTC-tijdstempel om naar lokale datum', () => {
  const { app } = laadApp();
  assert.equal(app.normaliseerSheetDatum('2026-06-25'), '2026-06-25');
  assert.equal(app.normaliseerSheetDatum(''), '');
  assert.equal(app.normaliseerSheetDatum(undefined), '');
  const lokaleMiddernacht = new Date(2026, 5, 25, 0, 0).toISOString();
  assert.equal(app.normaliseerSheetDatum(lokaleMiddernacht), '2026-06-25');
});

test('esc ontsnapt HTML-tekens', () => {
  const { app } = laadApp();
  assert.equal(app.esc('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(app.esc("O'Brien & Zn"), 'O&#39;Brien &amp; Zn');
  assert.equal(app.esc(null), '');
  assert.equal(app.esc(5), '5');
});

test('csvVeld quote altijd en verdubbelt aanhalingstekens', () => {
  const { app } = laadApp();
  assert.equal(app.csvVeld('Straat 5; achterbouw'), '"Straat 5; achterbouw"');
  assert.equal(app.csvVeld('zei "ok"'), '"zei ""ok"""');
  assert.equal(app.csvVeld(undefined), '""');
});

test('gewijzigd admin-wachtwoord blijft bewaard na herladen', () => {
  const eerste = laadApp();
  assert.equal(eerste.state.adminPw, eerste.state.STANDAARD_PW);
  eerste.el('nieuw-pw').value = 'n1euw-Wachtwoord';
  eerste.app.veranderPw();
  const bewaard = eerste.store.get('wr_pw');
  assert.ok(bewaard);
  const tweede = laadApp({ storage: { wr_pw: bewaard } });
  assert.equal(tweede.state.adminPw, 'n1euw-Wachtwoord');
});

test('laadTekst valt terug op standaard bij lege of corrupte waarde', () => {
  assert.equal(laadApp({ storage: { wr_pw: '""' } }).state.adminPw, 'admin123');
  assert.equal(laadApp({ storage: { wr_pw: '{kapot' } }).state.adminPw, 'admin123');
  assert.equal(laadApp({ storage: { wr_pw: '["a"]' } }).state.adminPw, 'admin123');
});

test('renderNamen ontsnapt namen (geen HTML-injectie via "Add a name")', () => {
  const { app, state, el } = laadApp();
  state.aannemers = [{ naam: '<img src=x onerror=alert(1)>', actief: true }];
  app.renderNamen();
  const knop = el('naam-grid').children[0];
  assert.ok(!knop.innerHTML.includes('<img'));
  assert.ok(knop.innerHTML.includes('&lt;img'));
});

test('renderOverzicht ontsnapt registratievelden', () => {
  const { app, state, el } = laadApp();
  state.huidigePersoon = 'Adam';
  state.registraties = [{
    id: 1, naam: 'Adam', datum: '2026-06-25', werf: '<b>werf</b>', start: '07:00', einde: '17:00',
    pauzeStart: '12:00', pauzeEinde: '12:30', urenTekst: '9h30', werken: '<script>x()</script>',
    problems: '', materials: '', issues: '',
  }];
  app.renderOverzicht();
  const html = el('overzicht-lijst').innerHTML;
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<b>werf'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('admin: Edit/Delete enkel voor lokale registraties, niet voor Sheet-rijen', () => {
  const { app, state, el } = laadApp();
  state.isAdmin = true;
  state.sheetRegistraties = [{ id: 'sheet_0', naam: 'Adam', datum: '2026-06-25', werf: 'X', werken: 'y', urenTekst: '8h' }];
  app.renderOverzicht('alle');
  assert.ok(!el('overzicht-lijst').innerHTML.includes('openEdit('));

  state.sheetRegistraties = [];
  state.registraties = [{ id: 123, naam: 'Adam', datum: '2026-06-25', werf: 'X', werken: 'y', urenTekst: '8h' }];
  app.renderOverzicht('alle');
  assert.ok(el('overzicht-lijst').innerHTML.includes('openEdit(123)'));
});

test('slaOp bewaart lokaal met correct afgeronde uren en stuurt naar de Sheet', async () => {
  const { app, state, el, fetchCalls } = laadApp({ fetch: async () => ({ json: async () => ({ today: [] }) }) });
  state.huidigePersoon = 'Adam';
  el('f-datum').value = '2026-06-25';
  el('f-werf').value = 'Diestsevest';
  el('f-werken').value = 'Metselwerk';
  el('f-start').value = '07:00';
  el('f-einde').value = '16:50';
  el('f-pauze-start').value = '12:00';
  el('f-pauze-einde').value = '12:30';
  await app.slaOp();
  const rec = state.registraties[0];
  assert.equal(rec.naam, 'Adam');
  assert.equal(rec.urenTekst, '9h20');
  assert.equal(rec.uren, 9.33);
  const post = fetchCalls.find((c) => c.init && c.init.method === 'POST');
  assert.ok(post);
  assert.equal(JSON.parse(post.init.body).werf, 'Diestsevest');
});

test('slaOp weigert als einde vóór start ligt', async () => {
  const { app, state, el } = laadApp();
  state.huidigePersoon = 'Adam';
  el('f-datum').value = '2026-06-25';
  el('f-werf').value = 'Diestsevest';
  el('f-werken').value = 'x';
  el('f-start').value = '17:00';
  el('f-einde').value = '07:00';
  el('f-pauze-start').value = '12:00';
  el('f-pauze-einde').value = '12:30';
  await app.slaOp();
  assert.equal(state.registraties.length, 0);
  assert.match(el('toast').textContent, /End time must be after start time/);
});
