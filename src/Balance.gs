const COLUMNAS_TRANSFERENCIAS = ['id', 'creadoEn', 'fecha', 'emisorId', 'receptorId', 'espacioId', 'moneda', 'montoCentavos', 'comentario'];

function calcularBalance_(gastos, transferencias) {
  const resultado = { persona1: { pagado: 0, corresponde: 0, enviado: 0, recibido: 0 }, persona2: { pagado: 0, corresponde: 0, enviado: 0, recibido: 0 }, cantidadGastos: gastos.length };
  const entero = valor => typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0;
  gastos.forEach(gasto => {
    if (gasto.moneda !== 'ARS' || !['persona1', 'persona2'].includes(gasto.pagadorId) || ![gasto.montoCentavos, gasto.persona1Centavos, gasto.persona2Centavos].every(entero) || gasto.montoCentavos <= 0 || gasto.persona1Centavos + gasto.persona2Centavos !== gasto.montoCentavos) throw new Error('Hay un gasto con importes o moneda inválidos. Revisá Movimientos en Sheets.');
    resultado[gasto.pagadorId].pagado += gasto.montoCentavos;
    resultado.persona1.corresponde += gasto.persona1Centavos;
    resultado.persona2.corresponde += gasto.persona2Centavos;
  });
  transferencias.forEach(t => {
    if (t.moneda !== 'ARS' || !['persona1', 'persona2'].includes(t.emisorId) || t.receptorId !== (t.emisorId === 'persona1' ? 'persona2' : 'persona1') || !entero(t.montoCentavos) || t.montoCentavos <= 0) throw new Error('Hay un pago inválido. Revisá los pagos guardados en Sheets.');
    resultado[t.emisorId].enviado += t.montoCentavos;
    resultado[t.receptorId].recibido += t.montoCentavos;
  });
  for (const persona of ['persona1', 'persona2']) {
    const r = resultado[persona];
    r.saldo = r.pagado - r.corresponde + r.enviado - r.recibido;
    if (!Object.values(r).every(Number.isSafeInteger)) throw new Error('El total excede el rango admitido.');
  }
  resultado.deudor = resultado.persona1.saldo > 0 ? 'persona2' : resultado.persona1.saldo < 0 ? 'persona1' : null;
  resultado.acreedor = resultado.deudor ? (resultado.deudor === 'persona1' ? 'persona2' : 'persona1') : null;
  resultado.deuda = Math.abs(resultado.persona1.saldo);
  return resultado;
}

function leerTransferencias_(hoja) {
  if (!hoja || hoja.getLastRow() === 0) return [];
  const datos = hoja.getDataRange().getValues();
  if (!COLUMNAS_TRANSFERENCIAS.every((nombre, i) => datos[0][i] === nombre)) throw new Error('Revisá las cabeceras de Transferencias.');
  return datos.slice(1).filter(fila => fila[0] && fila[5] === 'convivencia').map(fila => {
    const t = {};
    COLUMNAS_TRANSFERENCIAS.forEach((nombre, i) => {
      const valor = fila[i];
      t[nombre] = valor instanceof Date ? (nombre === 'fecha' ? Utilities.formatDate(valor, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd') : valor.toISOString()) : valor;
    });
    return t;
  }).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.creadoEn).localeCompare(String(a.creadoEn)));
}

function leerDatosBalance_(libro) {
  const hoja = libro.getSheetByName('Movimientos');
  const gastos = hoja && hoja.getLastRow() > 1 ? prepararHistorial_(hoja.getDataRange().getValues(), null) : [];
  return { gastos, transferencias: leerTransferencias_(libro.getSheetByName('Transferencias')) };
}

function obtenerBalance(mes) {
  exigirMiembro_();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '')) throw new Error('Seleccioná un mes válido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const id = PropertiesService.getScriptProperties().getProperty('DUO_SPREADSHEET_ID');
    const datos = id ? leerDatosBalance_(SpreadsheetApp.openById(id)) : { gastos: [], transferencias: [] };
    const delMes = valores => valores.filter(valor => String(valor.fecha).slice(0, 7) === mes);
    return { total: calcularBalance_(datos.gastos, datos.transferencias), mes: calcularBalance_(delMes(datos.gastos), delMes(datos.transferencias)), transferencias: delMes(datos.transferencias) };
  } finally { lock.releaseLock(); }
}

function validarTransferencia_(dato) {
  if (!dato || !/^[a-zA-Z0-9-]{16,80}$/.test(dato.id || '')) throw new Error('Identificador inválido. Recargá la página.');
  if (!['persona1', 'persona2'].includes(dato.emisor)) throw new Error('Seleccioná quién pagó.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dato.fecha || '') || !Number.isFinite(Date.parse(dato.fecha)) || new Date(dato.fecha).toISOString().slice(0, 10) !== dato.fecha) throw new Error('Ingresá una fecha válida.');
  const comentario = String(dato.comentario || '').trim();
  if (comentario.length > 500) throw new Error('El comentario admite hasta 500 caracteres.');
  return { id: dato.id, fecha: dato.fecha, emisorId: dato.emisor, receptorId: dato.emisor === 'persona1' ? 'persona2' : 'persona1', montoCentavos: montoCentavos_(dato.monto), comentario };
}

function guardarTransferencia(dato) {
  exigirMiembro_();
  const t = validarTransferencia_(dato);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const id = PropertiesService.getScriptProperties().getProperty('DUO_SPREADSHEET_ID');
    if (!id) throw new Error('Todavía no hay gastos para saldar.');
    const libro = SpreadsheetApp.openById(id);
    const datos = leerDatosBalance_(libro);
    // Comprobar el reintento antes de validar el saldo que ya pudo cambiar por este pago.
    const anterior = datos.transferencias.find(fila => fila.id === t.id);
    if (anterior) {
      if (anterior.emisorId !== t.emisorId || anterior.montoCentavos !== t.montoCentavos || anterior.fecha !== t.fecha) throw new Error('Este identificador ya corresponde a otro pago.');
      return { id: t.id };
    }
    const balance = calcularBalance_(datos.gastos, datos.transferencias);
    if (balance.deudor !== t.emisorId || t.montoCentavos > balance.deuda) throw new Error('El saldo cambió o el pago supera la deuda pendiente. Actualizá el balance y revisá el importe y quién pagó.');
    let hoja = libro.getSheetByName('Transferencias');
    if (!hoja) hoja = libro.insertSheet('Transferencias');
    if (!hoja.getLastRow()) { hoja.getRange(1, 1, 1, COLUMNAS_TRANSFERENCIAS.length).setValues([COLUMNAS_TRANSFERENCIAS]); hoja.setFrozenRows(1); }
    const comentario = /^[=+@\-']/.test(t.comentario) ? "'" + t.comentario : t.comentario;
    hoja.getRange(hoja.getLastRow() + 1, 1, 1, COLUMNAS_TRANSFERENCIAS.length).setValues([[t.id, new Date().toISOString(), t.fecha, t.emisorId, t.receptorId, 'convivencia', 'ARS', t.montoCentavos, comentario]]);
    SpreadsheetApp.flush();
    return { id: t.id };
  } finally { lock.releaseLock(); }
}
