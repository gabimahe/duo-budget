const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function entorno() {
  const c = vm.createContext({ exigirMiembro_: () => ({ persona: 'persona1', admin: true }),});
  for (const nombre of ['Balance', 'Inicio']) vm.runInContext(fs.readFileSync('src/' + nombre + '.gs', 'utf8'), c);
  return c;
}
const gasto = (id, fecha, categoria, montoCentavos = 10000) => ({ id, fecha, categoria, montoCentavos, persona1Centavos: montoCentavos / 2, persona2Centavos: montoCentavos / 2, moneda: 'ARS', pagadorId: 'persona1' });
test('resumen mensual excluye pagos del gasto, conserva deuda acumulada y agrupa categorías', () => {
  const r = entorno().resumirInicio_({ gastos: [gasto('1', '2026-08-01', 'Alquiler'), gasto('2', '2026-09-02', 'Farmacia'), gasto('3', '2026-09-03', 'Farmacia')], transferencias: [{ emisorId: 'persona2', receptorId: 'persona1', moneda: 'ARS', montoCentavos: 2000 }] }, '2026-09');
  assert.equal(r.totalCentavos, 20000); assert.equal(r.cantidad, 2);
  assert.equal(r.balance.deuda, 13000);
  assert.equal(r.categorias.length, 1); assert.equal(r.categorias[0].centavos, 20000);
  assert.deepEqual(Array.from(r.ultimos, g => g.id), ['3', '2']);
});
test('mes vacío conserva deuda y últimos gastos se limitan a cinco en orden', () => {
  const c = entorno();
  const datos = { gastos: Array.from({ length: 7 }, (_, i) => gasto(String(i), '2026-09-0' + (i + 1), 'Otros')), transferencias: [] };
  assert.deepEqual(Array.from(c.resumirInicio_(datos, '2026-09').ultimos, g => g.id), ['6', '5', '4', '3', '2']);
  const vacio = c.resumirInicio_(datos, '2026-10');
  assert.equal(vacio.totalCentavos, 0); assert.equal(vacio.categorias.length, 0); assert.equal(vacio.balance.deuda, 35000);
});
test('sin planilla devuelve vacío sin crear archivos y libera el bloqueo', () => {
  const c = entorno(); let liberado = false;
  c.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() { liberado = true; } }) };
  c.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) };
  assert.equal(c.obtenerInicio('2026-09').totalCentavos, 0); assert.equal(liberado, true);
  assert.throws(() => c.obtenerInicio('2026-13'));
});
