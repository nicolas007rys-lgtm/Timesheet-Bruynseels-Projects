// Laadt het <script>-blok uit index.html in een Node-vm met een minimale nep-DOM,
// zodat de app-logica getest kan worden zonder browser of externe afhankelijkheden.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractScript(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Geen inline <script> gevonden in index.html');
  return m[1];
}

function maakElement(id) {
  const classes = new Set();
  return {
    id,
    value: '',
    innerHTML: '',
    textContent: '',
    className: '',
    style: {},
    children: [],
    disabled: false,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, on) => { (on ?? !classes.has(c)) ? classes.add(c) : classes.delete(c); },
      contains: (c) => classes.has(c),
    },
    addEventListener() {},
    appendChild(el) { this.children.push(el); return el; },
    removeChild() {},
    focus() {},
    click() {},
  };
}

/**
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.storage] beginwaarden voor localStorage (ruwe strings)
 * @param {(url:string, init?:object)=>any} [opts.fetch] nep-fetch
 */
function laadApp(opts = {}) {
  const elementen = new Map();
  const store = new Map(Object.entries(opts.storage || {}));
  const fetchCalls = [];
  const document = {
    getElementById(id) {
      if (!elementen.has(id)) elementen.set(id, maakElement(id));
      return elementen.get(id);
    },
    createElement: (tag) => maakElement(tag),
    querySelectorAll: () => [],
    addEventListener() {},
    body: maakElement('body'),
  };
  const context = {
    document,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    navigator: { userAgent: 'node-test' },
    fetch: async (url, init) => {
      fetchCalls.push({ url, init });
      if (opts.fetch) return opts.fetch(url, init);
      throw new Error('offline');
    },
    setInterval: () => 0,
    setTimeout: () => 0,
    confirm: () => true,
    prompt: () => null,
    console,
    Date,
  };
  vm.createContext(context);
  const script = extractScript(HTML) + `
;globalThis.__state = {
  get registraties() { return registraties; }, set registraties(v) { registraties = v; },
  get sheetRegistraties() { return sheetRegistraties; }, set sheetRegistraties(v) { sheetRegistraties = v; },
  get aannemers() { return aannemers; }, set aannemers(v) { aannemers = v; },
  get werven() { return werven; }, set werven(v) { werven = v; },
  get adminPw() { return adminPw; },
  get isAdmin() { return isAdmin; }, set isAdmin(v) { isAdmin = v; },
  get huidigePersoon() { return huidigePersoon; }, set huidigePersoon(v) { huidigePersoon = v; },
  STANDAARD_PW,
};`;
  vm.runInContext(script, context, { filename: 'index.html<script>' });
  return { app: context, state: context.__state, el: (id) => document.getElementById(id), store, fetchCalls };
}

module.exports = { laadApp };
