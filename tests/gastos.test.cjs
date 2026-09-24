const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ exigirMiembro_: () => ({ persona: 'persona1', admin: true }),});
vm.runInContext(fs.readFileSync('src/Gastos.gs', 'utf8'), context);
const base = { id: '12345678-1234-1234-1234-123456789012', monto: '100,01', descripcion: 'Compra', fecha: '2026-09-09', categoria: 'Supermercado', pagador: 'persona1', espacio: 'convivencia', division: 'mitad' };
test('Otros exige detalle y las demás categorías descartan el detalle oculto', () => {
  for (const categoriaDetalle of ['', '  ', 'a'.repeat(101)]) assert.throws(() => context.validarGasto_({ ...base, categoria: 'Otros', categoriaDetalle }));
  assert.equal(context.validarGasto_({ ...base, categoria: 'Otros', categoriaDetalle: ' Mascotas ' }).categoriaDetalle, 'Mascotas');
  assert.equal(context.validarGasto_({ ...base, categoriaDetalle: 'Mascotas' }).categoriaDetalle, '');
});
test('amplía solo la cabecera del esquema anterior y rechaza columnas inesperadas', () => {
  const columnas = Array.from(vm.runInContext('COLUMNAS', context));
  let cabeceras = [...columnas.slice(0, -1), ''];
  const cambios = [];
  const hoja = { getRange: (...args) => ({ getValues: () => [cabeceras], setValues: valor => cambios.push([args, Array.from(valor[0])]) }) };
  context.asegurarColumnas_(hoja);
  assert.deepEqual(cambios, [[[1, 16, 1, 1], ['comentario']]]);
  cabeceras = columnas; context.asegurarColumnas_(hoja);
  assert.equal(cambios.length, 1);
  cabeceras = [...columnas.slice(0, 14), '', ''];
  context.asegurarColumnas_(hoja);
  assert.deepEqual(cambios[1], [[1, 15, 1, 2], ['categoriaDetalle', 'comentario']]);
  cabeceras = [...columnas.slice(0, -1), 'notas'];
  assert.throws(() => context.asegurarColumnas_(hoja));
});
test('Electrodomésticos admite comentario omitido, vacío o con texto', () => {
  for (const comentario of [undefined, '', '   ', 'Garantía de un año']) {
    const gasto = context.validarGasto_({ ...base, categoria: 'Electrodomésticos', comentario });
    assert.equal(gasto.comentario, (comentario || '').trim());
  }
  assert.throws(() => context.validarGasto_({ ...base, comentario: 'a'.repeat(501) }));
});
test('50/50 conserva cada centavo y asigna el resto a Persona2', () => {
  const g = context.validarGasto_(base);
  assert.equal(g.partePersona1, 5000); assert.equal(g.partePersona2, 5001);
});
test('invitación asigna el total al pagador', () => {
  for (const pagador of ['persona1', 'persona2']) {
    const g = context.validarGasto_({ ...base, pagador, division: 'invitacion' });
    assert.equal(g.partePersona1, pagador === 'persona1' ? 10001 : 0);
    assert.equal(g.partePersona2, pagador === 'persona2' ? 10001 : 0);
  }
});
test('porcentaje personalizado, incluidos extremos', () => {
  for (const porcentajePersona1 of ['0', '33.33', '100']) {
    const g = context.validarGasto_({ ...base, monto: '100', division: 'otro', porcentajePersona1 });
    assert.equal(g.partePersona1, Number(porcentajePersona1) * 100);
    assert.equal(g.partePersona1 + g.partePersona2, 10000);
  }
});
test('rechaza importes, fechas, catálogos y porcentajes inválidos', () => {
  for (const cambio of [{ monto: '0' }, { monto: '-1' }, { monto: '1.23,56' }, { monto: '1,001' }, { fecha: '2026-02-30' }, { descripcion: ' ' }, { categoria: 'Inventada' }, { pagador: 'otro' }, { espacio: 'viaje' }, { division: 'otro', porcentajePersona1: '' }, { division: 'otro', porcentajePersona1: '101' }]) {
    assert.throws(() => context.validarGasto_({ ...base, ...cambio }));
  }
});
test('interpreta moneda argentina en centavos sin perder precisión', () => {
  for (const [monto, esperado] of [['$1.000.000,00', 100000000], ['1000000', 100000000], ['1.001', 100100], ['$ 1.234,56', 123456], ['0,01', 1], ['999.999.999,99', 99999999999]]) {
    assert.equal(context.validarGasto_({ ...base, monto }).centavos, esperado);
  }
  for (const monto of ['1,234.56', '1.23', '1.0000', '1000000000', '$', '1e3']) assert.throws(() => context.validarGasto_({ ...base, monto }));
});
test('reintento del mismo ID no escribe una segunda fila y libera el bloqueo', () => {
  let writes = 0, releases = 0;
  let saved = false;
  const sheet = {
    getLastRow: () => saved ? 2 : 1,
    getRange: (row) => ({
      getValues: () => [vm.runInContext('COLUMNAS', context)],
      setValues: () => { writes++; saved = true; },
      createTextFinder: () => ({ matchEntireCell: () => ({ findNext: () => saved ? {} : null }) })
    })
  };
  context.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() { releases++; } }) };
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'sheet-id' }) };
  context.SpreadsheetApp = { openById: () => ({ getSheetByName: () => sheet, getUrl: () => 'https://docs.google.com/spreadsheets/d/sheet-id' }), flush() {} };
  context.guardarGasto(base); context.guardarGasto(base);
  assert.equal(writes, 1); assert.equal(releases, 2);
});
