const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ exigirMiembro_: () => ({ persona: 'persona1', admin: true }), Date, Utilities: { formatDate: date => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(date) } });
vm.runInContext(fs.readFileSync('src/Gastos.gs', 'utf8') + fs.readFileSync('src/Historial.gs', 'utf8'), context);
const columnas = Array.from(vm.runInContext('COLUMNAS', context));
const fila = (id, fecha, creadoEn, espacio = 'convivencia') => [id, creadoEn, fecha, 'Compra', 'Comida', 'persona1', espacio, 'ARS', 10000, 'mitad', 50, 50, 5000, 5000];
test('filtra por mes y espacio, ordena por fecha y desempata por creación', () => {
  const datos = [columnas, fila('a', '2026-09-01', '2026-09-03T10:00:00Z'), fila('b', '2026-09-02', '2026-09-03T11:00:00Z'), fila('c', '2026-09-02', '2026-09-03T12:00:00Z'), fila('d', '2026-08-31', ''), fila('e', '2026-09-04', '', 'viaje')];
  const resultado = context.prepararHistorial_(datos, '2026-09');
  assert.deepEqual(Array.from(resultado, gasto => gasto.id), ['c', 'b', 'a']);
  assert.equal(resultado[0].categoria, 'Comida');
});
test('lee esquemas anteriores y convierte fechas de Sheets a datos serializables', () => {
  const resultado = context.prepararHistorial_([columnas.slice(0, 14), fila('a', new Date('2026-09-01T03:00:00Z'), new Date('2026-09-02T00:00:00Z'))], '2026-09');
  assert.equal(resultado[0].fecha, '2026-09-01');
  assert.equal(resultado[0].creadoEn, '2026-09-02T00:00:00.000Z');
  assert.equal(resultado[0].comentario, '');
  assert.equal(resultado[0].categoriaDetalle, '');
});
test('conserva comentario y detalle como texto, y devuelve mes vacío', () => {
  const datos = [columnas, [...fila('a', '2026-09-01', ''), 'Mascotas', '<script>texto</script>']];
  assert.equal(context.prepararHistorial_(datos, '2026-09')[0].comentario, '<script>texto</script>');
  assert.equal(context.prepararHistorial_(datos, '2026-10').length, 0);
});
test('rechaza meses inválidos y consultar sin planilla no crea archivos', () => {
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) };
  for (const mes of ['', '2026-13', '2026-1']) assert.throws(() => context.listarGastos(mes));
  assert.equal(context.listarGastos('2026-09').length, 0);
});
test('el JavaScript de la interfaz tiene sintaxis válida', () => {
  const html = fs.readFileSync('src/Index.html', 'utf8');
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
});
