const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function entorno() {
  const props = { DUO_ADMIN_EMAIL: 'owner@example.com' }, hojas = new Map();
  let correo = 'owner@example.com', creaciones = 0, fallo = '', bloqueado = false;
  const libro = { getId: () => 'nueva-planilla', getOwner: () => ({ getEmail: () => 'owner@example.com' }), setSpreadsheetTimeZone() {},
    getSheetByName: n => hojas.get(n), insertSheet(n) {
      const filas = []; const hoja = { getLastRow: () => filas.length, setFrozenRows() {}, getRange: () => ({ getValues: () => filas, setValues(v) { filas.push(...v); } }) };
      hojas.set(n, hoja); return hoja;
    }
  };
  const c = vm.createContext({
    Session: { getActiveUser: () => ({ getEmail: () => correo }), getEffectiveUser: () => ({ getEmail: () => correo }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty(k, v) { assert.ok(bloqueado); if (fallo === k) { fallo = ''; throw Error('Corte'); } props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() { assert.equal(bloqueado, false); bloqueado = true; }, releaseLock() { bloqueado = false; } }) },
    SpreadsheetApp: { create() { creaciones++; return libro; }, openById(id) { assert.equal(id, 'nueva-planilla'); return libro; }, flush() { if (fallo === 'flush') { fallo = ''; throw Error('Corte'); } } }
  });
  for (const n of ['Acceso', 'Instalacion', 'Gastos', 'Fijos', 'Patrimonio', 'Balance']) vm.runInContext(fs.readFileSync('src/' + n + '.gs', 'utf8'), c);
  return { c, props, hojas, como: v => { correo = v; }, fallar: v => { fallo = v; }, creaciones: () => creaciones };
}
const datos = { nombre: 'Dúo — Mi hogar', persona1: 'Alex', persona2: 'Sam' };
test('solo la cuenta configurada puede crear y el correo del cliente no concede acceso', () => {
  const e = entorno(); e.como('visitante@example.com');
  assert.equal(e.c.obtenerAcceso().estado, 'sin-acceso');
  assert.throws(() => e.c.configurarInstalacion({ ...datos, correo: 'owner@example.com' }), /administradora/);
  assert.equal(e.creaciones(), 0);
  delete e.props.DUO_ADMIN_EMAIL; e.como('owner@example.com');
  assert.throws(() => e.c.configurarInstalacion(datos), /administradora/);
});
test('crea una planilla, prepara cabeceras y devuelve nombres; reintentar no duplica', () => {
  const e = entorno(); assert.equal(e.c.obtenerAcceso().estado, 'configurar');
  assert.equal(e.c.configurarInstalacion(datos).existente, false);
  assert.equal(e.c.configurarInstalacion(datos).existente, true);
  assert.equal(e.creaciones(), 1); assert.equal(e.hojas.size, 4);
  assert.equal(e.c.obtenerAcceso().nombres.persona1, 'Alex');
  assert.equal(e.c.obtenerAcceso().persona, 'persona1');
  e.como('visitante@example.com'); assert.equal(e.c.obtenerAcceso().nombres, undefined);
});
test('datos inválidos no crean ni dejan una instalación pendiente', () => {
  const e = entorno();
  for (const cambio of [{ nombre: '' }, { persona1: '' }, { persona2: 'Alex' }, { nombre: 'a'.repeat(61) }]) assert.throws(() => e.c.configurarInstalacion({ ...datos, ...cambio }));
  assert.equal(e.creaciones(), 0); assert.equal(e.props.DUO_INSTALACION, undefined);
});
test('un corte al preparar hojas se recupera en la misma planilla con los datos originales', () => {
  const e = entorno(); e.fallar('flush'); assert.throws(() => e.c.configurarInstalacion(datos));
  assert.throws(() => e.c.exigirMiembro_());
  e.c.configurarInstalacion({ ...datos, persona1: 'Cambio' });
  assert.equal(e.creaciones(), 1); assert.equal(e.c.obtenerAcceso().nombres.persona1, 'Alex');
});
test('creación incierta no vuelve a crear y admite recuperación explícita por id', () => {
  const e = entorno(); e.fallar('DUO_SPREADSHEET_ID'); assert.throws(() => e.c.configurarInstalacion(datos));
  assert.throws(() => e.c.configurarInstalacion(datos), /No creamos otra planilla/);
  assert.equal(e.creaciones(), 1);
  e.props.DUO_SPREADSHEET_ID = 'nueva-planilla'; e.c.configurarInstalacion(datos);
  assert.equal(e.c.obtenerAcceso().estado, 'miembro'); assert.equal(e.creaciones(), 1);
});
