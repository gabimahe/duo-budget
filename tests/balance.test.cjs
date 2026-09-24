const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function entorno() {
  const c = vm.createContext({ exigirMiembro_: () => ({ persona: 'persona1', admin: true }), Date });
  for (const nombre of ['Gastos', 'Historial', 'Balance']) vm.runInContext(fs.readFileSync('src/' + nombre + '.gs', 'utf8'), c);
  return c;
}
const gasto = (pagadorId, montoCentavos, persona1Centavos, fecha = '2026-09-09') => ({ pagadorId, montoCentavos, persona1Centavos, persona2Centavos: montoCentavos - persona1Centavos, moneda: 'ARS', fecha });
const pago = (emisorId, montoCentavos, fecha = '2026-09-10') => ({ emisorId, receptorId: emisorId === 'persona1' ? 'persona2' : 'persona1', montoCentavos, moneda: 'ARS', fecha });
test('balance vacío, invitaciones y direcciones de deuda', () => {
  const c = entorno();
  assert.equal(c.calcularBalance_([], []).deuda, 0);
  assert.equal(c.calcularBalance_([gasto('persona1', 10000, 10000), gasto('persona2', 20000, 0)], []).deuda, 0);
  assert.equal(c.calcularBalance_([gasto('persona1', 10000, 5000)], []).deudor, 'persona2');
  assert.equal(c.calcularBalance_([gasto('persona2', 10000, 3000)], []).deuda, 3000);
  assert.equal(c.calcularBalance_([gasto('persona2', 10000, 3000)], []).deudor, 'persona1');
});
test('pago parcial y total reducen deuda sin modificar gastos ni partes', () => {
  const c = entorno();
  const parcial = c.calcularBalance_([gasto('persona1', 10001, 5000)], [pago('persona2', 2000)]);
  assert.equal(parcial.deuda, 3001);
  assert.equal(parcial.persona1.pagado, 10001); assert.equal(parcial.persona2.pagado, 0);
  assert.equal(parcial.persona1.corresponde, 5000); assert.equal(parcial.persona2.corresponde, 5001);
  assert.equal(parcial.persona1.saldo + parcial.persona2.saldo, 0);
  assert.equal(c.calcularBalance_([gasto('persona1', 10001, 5000)], [pago('persona2', 5001)]).deuda, 0);
});
test('rechaza datos corruptos en Sheets en lugar de calcular una deuda incorrecta', () => {
  const c = entorno();
  for (const g of [{ ...gasto('persona1', 100, 50), moneda: 'USD' }, { ...gasto('persona1', 100, 50), persona1Centavos: 60 }, { ...gasto('persona1', 100, 50), montoCentavos: '100' }]) assert.throws(() => c.calcularBalance_([g], []));
  assert.throws(() => c.calcularBalance_([], [{ ...pago('persona1', 100), receptorId: 'persona1' }]));
});
test('total incluye meses anteriores; desglose solo incluye fechas del mes', () => {
  const c = entorno();
  c.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'libro' }) };
  c.SpreadsheetApp = { openById: () => ({}) };
  c.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  c.leerDatosBalance_ = () => ({ gastos: [gasto('persona1', 10000, 5000, '2026-08-01'), gasto('persona1', 2000, 1000)], transferencias: [pago('persona2', 3000)] });
  const r = c.obtenerBalance('2026-09');
  assert.equal(r.total.deuda, 3000); assert.equal(r.mes.persona1.pagado, 2000);
  assert.equal(r.mes.persona1.saldo, -2000); assert.equal(r.transferencias.length, 1);
  assert.throws(() => c.obtenerBalance('2026-13'));
});
test('guardado es idempotente y comprueba deuda dentro del bloqueo', () => {
  const c = entorno();
  let cabeceras, filas = [], bloqueado = false, liberaciones = 0;
  const hoja = { getLastRow: () => cabeceras ? filas.length + 1 : 0, setFrozenRows() {}, getRange: row => ({ setValues: valores => { assert.equal(bloqueado, true); if (row === 1) cabeceras = valores[0]; else filas.push(valores[0]); } }) };
  const libro = { getSheetByName: () => hoja };
  c.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'libro' }) };
  c.SpreadsheetApp = { openById: () => libro, flush() {} };
  c.LockService = { getScriptLock: () => ({ waitLock() { bloqueado = true; }, releaseLock() { bloqueado = false; liberaciones++; } }) };
  c.leerDatosBalance_ = () => ({ gastos: [gasto('persona1', 10000, 5000)], transferencias: filas.map(fila => Object.fromEntries(Array.from(cabeceras, (nombre, i) => [nombre, fila[i]]))) });
  const dato = { id: '12345678-1234-1234-1234-123456789012', emisor: 'persona2', monto: '$50,00', fecha: '2026-09-10', comentario: '=1+1' };
  assert.throws(() => c.guardarTransferencia({ ...dato, monto: '50,01' }));
  assert.throws(() => c.guardarTransferencia({ ...dato, emisor: 'persona1' }));
  assert.equal(filas.length, 0);
  c.guardarTransferencia(dato); c.guardarTransferencia(dato);
  assert.equal(filas.length, 1); assert.equal(filas[0][8], "'=1+1");
  assert.throws(() => c.guardarTransferencia({ ...dato, id: '12345678-1234-1234-1234-123456789013' }));
  assert.equal(liberaciones, 5); assert.equal(bloqueado, false);
});
test('valida fecha y monto de transferencia', () => {
  const c = entorno();
  const base = { id: '12345678-1234-1234-1234-123456789012', emisor: 'persona1', monto: '1.000,00', fecha: '2026-09-09' };
  assert.equal(c.validarTransferencia_(base).montoCentavos, 100000);
  for (const cambio of [{ emisor: 'otro' }, { fecha: '2026-02-30' }, { monto: '-1' }, { comentario: 'x'.repeat(501) }]) assert.throws(() => c.validarTransferencia_({ ...base, ...cambio }));
});
