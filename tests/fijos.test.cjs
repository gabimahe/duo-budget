const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function entorno() {
  const hojas = new Map(); let bloqueado = false, failFlush = false;
  function hoja() {
    const filas = [];
    return { filas, getLastRow: () => filas.length, setFrozenRows() {}, getDataRange: () => ({ getValues: () => filas }),
      getRange: (r, col, n = 1, m = 1) => ({
        getValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => filas[r - 1 + i]?.[col - 1 + j] ?? '')),
        setValues: valores => { assert.equal(bloqueado, true); valores.forEach((f, i) => { filas[r - 1 + i] ??= []; f.forEach((v, j) => filas[r - 1 + i][col - 1 + j] = v); }); },
        createTextFinder: id => ({ matchEntireCell: () => ({ findNext: () => filas.slice(r - 1, r - 1 + n).find(f => f[col - 1] === id) || null }) })
      }) };
  }
  const libro = { getSheetByName: n => hojas.get(n), insertSheet: n => { const h = hoja(); hojas.set(n, h); return h; }, getUrl: () => 'url' };
  const c = vm.createContext({ exigirMiembro_: () => ({ persona: 'persona1', admin: true }), Date, Utilities: { formatDate: () => '2026-10-10' },
    LockService: { getScriptLock: () => ({ waitLock() { assert.equal(bloqueado, false); bloqueado = true; }, releaseLock() { bloqueado = false; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'libro' }) },
    SpreadsheetApp: { openById: () => libro, flush() { if (failFlush) { failFlush = false; throw Error('Respuesta perdida'); } } }
  });
  for (const n of ['Gastos', 'Historial', 'Balance', 'Fijos', 'Patrimonio', 'Inicio']) vm.runInContext(fs.readFileSync('src/' + n + '.gs', 'utf8'), c);
  return { c, hojas, perderRespuesta: () => { failFlush = true; } };
}
const fijo = { id: '12345678-1234-1234-1234-123456789012', mes: '2026-09', vencimiento: '2026-09-30', descripcion: 'Alquiler', categoria: 'Alquiler', monto: '$1.000,00' };
const pago = { id: fijo.id, fecha: '2026-10-01', monto: '$1.100,00', pagador: 'persona2', division: 'mitad' };
const bien = { id: '32345678-1234-1234-1234-123456789012', modo: 'nuevo', tipo: 'Muebles', estado: 'En uso', descripcion: 'Mesa', monto: '10.000,00', fecha: '2026-10-01', pagador: 'persona1', division: 'mitad', notas: 'Madera' };
test('pago de un gasto respeta reparto, permite superar deuda neta y conserva cada centavo', () => {
  const { c, hojas } = entorno();
  const id = '82345678-1234-1234-1234-123456789012';
  c.guardarGasto({ ...bien, id, monto: '100.000,00', categoria: 'Otros', categoriaDetalle: 'Hogar', espacio: 'convivencia', division: 'otro', porcentajePersona1: '70' });
  c.guardarGasto({ ...bien, id: '92345678-1234-1234-1234-123456789012', monto: '20.000,00', categoria: 'Otros', categoriaDetalle: 'Hogar', espacio: 'convivencia', pagador: 'persona2' });
  assert.equal(c.obtenerBalance('2026-10').total.deuda, 2000000);
  const t = { id: '72345678-1234-1234-1234-123456789012', movimientoId: id, emisor: 'persona2', monto: '10.000,00', fecha: '2026-10-02' };
  assert.throws(() => c.guardarTransferencia({ ...t, emisor: 'persona1' }));
  assert.throws(() => c.guardarTransferencia({ ...t, fecha: '2026-09-30' }));
  c.guardarTransferencia(t); c.guardarTransferencia(t);
  assert.equal(c.obtenerBalance('2026-10').pendientes.find(g => g.id === id).pendiente, 2000000);
  const resto = { ...t, id: '62345678-1234-1234-1234-123456789012', monto: '20.000,00' };
  assert.throws(() => c.guardarTransferencia({ ...resto, monto: '20.000,01' }));
  c.guardarTransferencia(resto);
  const resultado = c.obtenerBalance('2026-10');
  assert.equal(resultado.total.deudor, 'persona1'); assert.equal(resultado.total.deuda, 1000000);
  assert.equal(resultado.pendientes.some(g => g.id === id), false);
  assert.equal(hojas.get('Transferencias').filas.length, 3);
  assert.throws(() => c.guardarTransferencia({ ...resto, id: '52345678-1234-1234-1234-123456789012', monto: '1,00' }));
  assert.throws(() => c.guardarTransferencia({ ...t, movimientoId: '' }));
});
test('pagos históricos sin vínculo conservan el saldo y migran sin asignarse a gastos', () => {
  const { c, hojas } = entorno();
  c.guardarGasto({ ...bien, categoria: 'Otros', categoriaDetalle: 'Hogar', espacio: 'convivencia' });
  const t = { id: '72345678-1234-1234-1234-123456789012', emisor: 'persona2', monto: '1.000,00', fecha: '2026-10-02' };
  c.guardarTransferencia(t);
  const filas = hojas.get('Transferencias').filas;
  filas.forEach(f => f.pop()); // Esquema histórico de nueve columnas.
  assert.equal(c.obtenerBalance('2026-10').total.deuda, 400000);
  assert.equal(c.obtenerBalance('2026-10').pendientes[0].pendiente, 500000);
  c.guardarTransferencia({ ...t, id: '62345678-1234-1234-1234-123456789012', movimientoId: bien.id });
  assert.equal(filas[0][9], 'movimientoId');
  assert.equal(filas[1][9], undefined);
  assert.equal(c.obtenerBalance('2026-10').pendientes[0].pendiente, 400000);
});
test('permite corregir un importe rechazado y confirma reintentos sin duplicar ni cambiar lo guardado', () => {
  const { c, hojas } = entorno();
  const compra = { ...bien, descripcion: 'Estantes para el baño', tipo: 'Otros', monto: '19833.75', division: 'otro', porcentajePersona1: '100' };
  assert.throws(() => c.guardarPatrimonio(compra), /Ingresá un monto/);
  assert.equal(hojas.size, 0);
  assert.equal(c.guardarPatrimonio({ ...compra, monto: '$19.833,75' }).yaRegistrada, false);
  assert.equal(c.guardarPatrimonio({ ...compra, monto: '$20.000,00' }).yaRegistrada, true);
  const registrado = c.listarPatrimonio()[0].gasto;
  assert.equal(registrado.montoCentavos, 1983375);
  assert.equal(registrado.persona1Centavos, 1983375);
  assert.equal(registrado.persona2Centavos, 0);
  assert.equal(hojas.get('Movimientos').filas.length, 2);
  assert.equal(hojas.get('Patrimonio').filas.length, 2);
});
test('compra nueva cuenta una vez en balance y se separa del gasto corriente', () => {
  const { c, hojas } = entorno(); c.guardarPatrimonio(bien); c.guardarPatrimonio(bien);
  assert.equal(hojas.get('Movimientos').filas.length, 2); assert.equal(hojas.get('Patrimonio').filas.length, 2);
  assert.equal(c.listarPatrimonio()[0].gasto.descripcion, 'Mesa');
  const inicio = c.obtenerInicio('2026-10');
  assert.equal(inicio.totalCentavos, 0); assert.equal(inicio.comprasCentavos, 1000000); assert.equal(inicio.balance.deuda, 500000);
  assert.equal(inicio.categorias.length, 0);
});
test('recupera una compra incompleta después de perder la respuesta sin volver a ingresar datos', () => {
  const { c, hojas, perderRespuesta } = entorno(); perderRespuesta();
  assert.throws(() => c.guardarPatrimonio(bien));
  assert.equal(c.listarPatrimonio()[0].pendiente, true);
  c.guardarPatrimonio({ id: bien.id }); c.guardarPatrimonio({ id: bien.id });
  assert.equal(c.listarPatrimonio()[0].pendiente, false); assert.equal(hojas.get('Movimientos').filas.length, 2);
});
test('vincular un gasto existente conserva balance y no permite duplicar vínculo ni vincular fijos', () => {
  const { c, hojas } = entorno();
  c.guardarGasto({ ...bien, id: '42345678-1234-1234-1234-123456789012', categoria: 'Otros', categoriaDetalle: 'Muebles', espacio: 'convivencia' });
  const movimientoId = c.opcionesVincularPatrimonio('2026-10')[0].id;
  const antes = c.obtenerBalance('2026-10').total.deuda;
  c.guardarPatrimonio({ ...bien, modo: 'existente', movimientoId });
  assert.equal(hojas.get('Movimientos').filas.length, 2); assert.equal(c.obtenerBalance('2026-10').total.deuda, antes);
  assert.equal(c.opcionesVincularPatrimonio('2026-10').length, 0);
  assert.throws(() => c.guardarPatrimonio({ ...bien, id: '52345678-1234-1234-1234-123456789012', modo: 'existente', movimientoId }));
  c.guardarFijo(fijo); c.pagarFijo(pago);
  assert.throws(() => c.guardarPatrimonio({ ...bien, id: '62345678-1234-1234-1234-123456789012', modo: 'existente', movimientoId: 'fijo-' + fijo.id }));
});
test('patrimonio valida metadatos antes de escribir', () => {
  const { c, hojas } = entorno();
  for (const cambio of [{ garantia: '2026-02-30' }, { notas: 'x'.repeat(501) }, { tipo: 'Inventado' }, { estado: 'Inventado' }, { monto: '-1' }]) assert.throws(() => c.guardarPatrimonio({ ...bien, ...cambio }));
  assert.equal(hojas.size, 0);
});
test('obligación no cuenta como gasto; pagar en otro mes genera un solo movimiento aun tras respuesta perdida', () => {
  const { c, hojas, perderRespuesta } = entorno();
  c.guardarFijo(fijo); c.guardarFijo(fijo);
  assert.equal(hojas.get('GastosFijos').filas.length, 2);
  assert.equal(c.listarFijos('2026-09')[0].estado, 'vencido');
  assert.equal(c.obtenerInicio('2026-09').totalCentavos, 0);
  perderRespuesta(); assert.throws(() => c.pagarFijo(pago), /perdida/);
  assert.equal(c.pagarFijo(pago).yaPagado, true);
  assert.equal(hojas.get('Movimientos').filas.length, 2);
  assert.equal(c.listarFijos('2026-09')[0].pago.fecha, '2026-10-01');
  assert.equal(c.obtenerInicio('2026-09').fijos.pagados, 1);
  assert.equal(c.obtenerInicio('2026-09').totalCentavos, 0);
  assert.equal(c.obtenerInicio('2026-10').totalCentavos, 110000);
  assert.equal(c.obtenerBalance('2026-10').total.deuda, 55000);
});
test('copiar es idempotente, conserva pasado y nunca copia estado pagado', () => {
  const { c } = entorno(); c.guardarFijo(fijo); c.pagarFijo(pago);
  assert.equal(c.copiarFijos('2026-10').cantidad, 1);
  assert.equal(c.copiarFijos('2026-10').cantidad, 0);
  assert.equal(c.listarFijos('2026-10')[0].estado, 'pendiente');
  assert.equal(c.listarFijos('2026-09')[0].estado, 'pagado');
  assert.equal(c.copiarFijos('2026-11').cantidad, 1);
});
test('copia ajusta fin de mes y cruce de año', () => {
  const { c } = entorno();
  const filas = [{ ...fijo, serieId: fijo.id, mes: '2028-01', vencimiento: '2028-01-31' }];
  assert.equal(c.prepararCopiaFijos_(filas, '2028-02')[0].vencimiento, '2028-02-29');
  filas[0].mes = '2026-12'; filas[0].vencimiento = '2026-12-31';
  assert.equal(c.prepararCopiaFijos_(filas, '2027-01')[0].vencimiento, '2027-01-31');
});
test('valida fechas, duplicados, importes y división sin registrar gastos inválidos', () => {
  const { c, hojas } = entorno();
  assert.throws(() => c.guardarFijo({ ...fijo, vencimiento: '2026-10-01' }));
  assert.throws(() => c.guardarFijo({ ...fijo, monto: '-1' }));
  c.guardarFijo(fijo);
  assert.throws(() => c.guardarFijo({ ...fijo, id: '22345678-1234-1234-1234-123456789012' }));
  assert.throws(() => c.pagarFijo({ ...pago, fecha: '2026-12-01' }));
  assert.throws(() => c.pagarFijo({ ...pago, division: 'otro', porcentajePersona1: 101 }));
  assert.equal(hojas.has('Movimientos'), false);
  c.pagarFijo({ ...pago, division: 'invitacion' });
  assert.equal(c.obtenerBalance('2026-10').total.deuda, 0);
});
