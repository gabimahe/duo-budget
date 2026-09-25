const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
test('selección filtra por pagador y sugiere pendiente, con saldo general separado', () => {
  const html = fs.readFileSync('src/Index.html', 'utf8');
  const from = html.indexOf('      function actualizarGastosPago()');
  const to = html.indexOf("      formularioTransferencia.elements.emisor.addEventListener", from);
  const selector = { value: '', options: [], replaceChildren(o) { this.options = [o]; this.value = ''; }, add(o) { this.options.push(o); } };
  const elements = { movimientoId: selector, emisor: { value: 'persona2' }, monto: { value: '' } };
  const detalle = {};
  const c = vm.createContext({ formularioTransferencia: { elements },
    pendientesPago: [{ id: 'a', descripcion: 'Alquiler', fecha: '2026-09-01', deudor: 'persona2', parte: 3000000, pagado: 1000000, pendiente: 2000000, porcentaje: 30 }, { id: 'b', descripcion: 'Luz', fecha: '2026-09-01', deudor: 'persona1', parte: 1000000, pagado: 0, pendiente: 1000000, porcentaje: 50 }],
    saldoPago: { deudor: 'persona2', deuda: 1000000 },
    formatearMoneda: n => n.toFixed(2), document: { getElementById: () => detalle },
    Option: function(text, value) { this.text = text; this.value = value; }
  });
  vm.runInContext(html.slice(from, to), c);
  c.actualizarGastosPago();
  assert.deepEqual(selector.options.map(o => o.value), ['', 'a']);
  assert.equal(elements.monto.value, '10000.00');
  selector.value = 'a'; c.sugerirPago();
  assert.equal(elements.monto.value, '20000.00'); assert.match(detalle.textContent, /30 %/);
  elements.emisor.value = 'persona1'; c.actualizarGastosPago();
  assert.deepEqual(selector.options.map(o => o.value), ['', 'b']);
  assert.equal(elements.monto.value, '');
});
