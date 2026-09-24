const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('el formulario envía las correcciones con el mismo id y muestra confirmación al guardar o recuperar', () => {
  const html = fs.readFileSync('src/Index.html', 'utf8');
  const inicio = html.indexOf("      formBien.addEventListener('submit'");
  const fin = html.indexOf("      document.getElementById('cerrar-bien')", inicio);
  let enviar, exito, fallo, cargas = 0, cierres = 0;
  const solicitudes = [];
  const elementos = { 'mensaje-bien': {}, 'confirmacion-bien': { hidden: true } };
  const formBien = {
    valores: { monto: '19833.75', descripcion: 'Estantes para el baño' },
    addEventListener: (_, handler) => { enviar = handler; }
  };
  const camposBien = { disabled: false };
  const run = {
    withSuccessHandler(handler) { exito = handler; return this; },
    withFailureHandler(handler) { fallo = handler; return this; },
    guardarPatrimonio(dato) { solicitudes.push(dato); }
  };
  vm.runInNewContext(html.slice(inicio, fin), {
    formBien, camposBien, idBien: 'id-estable',
    FormData: class { constructor(form) { return Object.entries(form.valores); } },
    document: { getElementById: id => elementos[id] },
    dialogoBien: { close: () => { cierres++; } },
    cargarBienes: () => { cargas++; }, google: { script: { run } }
  });
  const evento = { preventDefault() {} };
  enviar(evento);
  enviar(evento); // Doble clic durante la solicitud no genera otro envío.
  assert.equal(solicitudes.length, 1);
  fallo({ message: 'Ingresá un monto válido.' });
  assert.equal(camposBien.disabled, false);
  assert.match(elementos['mensaje-bien'].textContent, /Podés corregir/);
  formBien.valores.monto = '$19.833,75';
  enviar(evento);
  assert.equal(solicitudes[1].monto, '$19.833,75');
  assert.equal(solicitudes[1].id, solicitudes[0].id);
  exito({ yaRegistrada: false });
  assert.equal(elementos['confirmacion-bien'].hidden, false);
  assert.equal(elementos['confirmacion-bien'].textContent, 'Compra guardada correctamente.');
  exito({ yaRegistrada: true });
  assert.match(elementos['confirmacion-bien'].textContent, /datos originales, sin duplicarla/);
  assert.equal(cargas, 2);
  assert.equal(cierres, 2);
});
