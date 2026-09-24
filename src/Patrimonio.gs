const COLUMNAS_PATRIMONIO = ['id', 'movimientoId', 'tipo', 'estado', 'garantia', 'notas', 'gastoJson'];
function leerPatrimonio_(libro) {
  const hoja = libro && libro.getSheetByName('Patrimonio');
  if (!hoja || !hoja.getLastRow()) return [];
  const filas = hoja.getDataRange().getValues();
  if (!COLUMNAS_PATRIMONIO.every((c, i) => filas[0][i] === c)) throw new Error('Revisá las cabeceras de Patrimonio.');
  return filas.slice(1).filter(f => f[0]).map(f => Object.fromEntries(COLUMNAS_PATRIMONIO.map((c, i) => [c, f[i] instanceof Date ? Utilities.formatDate(f[i], 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd') : f[i]])));
}
function listarPatrimonio() {
  exigirMiembro_();
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const id = PropertiesService.getScriptProperties().getProperty('DUO_SPREADSHEET_ID');
    if (!id) return [];
    const libro = SpreadsheetApp.openById(id), gastos = leerDatosBalance_(libro).gastos;
    return leerPatrimonio_(libro).map(p => {
      const gasto = gastos.find(g => g.id === p.movimientoId);
      return { id: p.id, tipo: p.tipo, estado: p.estado, garantia: p.garantia, notas: p.notas, gasto: gasto || null, pendiente: !gasto };
    }).sort((a, b) => Number(b.pendiente) - Number(a.pendiente) || String(b.gasto && b.gasto.fecha).localeCompare(String(a.gasto && a.gasto.fecha)));
  } finally { lock.releaseLock(); }
}
function opcionesVincularPatrimonio(mes) {
  exigirMiembro_();
  validarMesFijo_(mes);
  const id = PropertiesService.getScriptProperties().getProperty('DUO_SPREADSHEET_ID');
  if (!id) return [];
  const libro = SpreadsheetApp.openById(id), usados = new Set(leerPatrimonio_(libro).map(p => p.movimientoId));
  return leerDatosBalance_(libro).gastos.filter(g => g.fecha.slice(0, 7) === mes && !usados.has(g.id) && !g.id.startsWith('fijo-') && !g.id.startsWith('bien-'));
}
function guardarPatrimonio(dato) {
  exigirMiembro_();
  if (!dato || !/^[a-zA-Z0-9-]{16,64}$/.test(dato.id || '')) throw new Error('Identificador inválido.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const libro = libroFijos_(), registros = leerPatrimonio_(libro);
    let registro = registros.find(p => p.id === dato.id);
    const yaRegistrada = Boolean(registro);
    if (!registro) {
      if (!['Electrodomésticos', 'Muebles', 'Tecnología', 'Otros'].includes(dato.tipo)) throw new Error('Elegí un tipo de compra.');
      if (!['En uso', 'Guardado', 'Vendido', 'Donado'].includes(dato.estado)) throw new Error('Elegí un estado válido.');
      const garantia = String(dato.garantia || ''), notas = String(dato.notas || '').trim();
      if (garantia && (!/^\d{4}-\d{2}-\d{2}$/.test(garantia) || !Number.isFinite(Date.parse(garantia)) || new Date(garantia).toISOString().slice(0, 10) !== garantia)) throw new Error('Ingresá una fecha de garantía válida.');
      if (notas.length > 500) throw new Error('Las notas admiten hasta 500 caracteres.');
      let movimientoId, gastoJson = '';
      if (dato.modo === 'existente') {
        const gasto = leerDatosBalance_(libro).gastos.find(g => g.id === dato.movimientoId);
        if (!gasto || gasto.id.startsWith('fijo-') || gasto.id.startsWith('bien-')) throw new Error('Elegí un gasto disponible del historial.');
        movimientoId = gasto.id;
        if (registros.some(p => p.movimientoId === movimientoId)) throw new Error('Ese gasto ya está vinculado a Patrimonio.');
      } else if (dato.modo === 'nuevo') {
        movimientoId = 'bien-' + dato.id;
        const gasto = validarGasto_(Object.assign({}, dato, { id: movimientoId, espacio: 'convivencia', categoria: dato.tipo === 'Electrodomésticos' ? dato.tipo : 'Otros', categoriaDetalle: dato.tipo }));
        gastoJson = JSON.stringify(gasto);
      } else throw new Error('Elegí cómo agregar la compra.');
      registro = { id: dato.id, movimientoId, tipo: dato.tipo, estado: dato.estado, garantia, notas, gastoJson };
      let hoja = libro.getSheetByName('Patrimonio');
      if (!hoja) hoja = libro.insertSheet('Patrimonio');
      if (!hoja.getLastRow()) { hoja.getRange(1, 1, 1, COLUMNAS_PATRIMONIO.length).setValues([COLUMNAS_PATRIMONIO]); hoja.setFrozenRows(1); }
      hoja.getRange(hoja.getLastRow() + 1, 1, 1, COLUMNAS_PATRIMONIO.length).setValues([COLUMNAS_PATRIMONIO.map(c => typeof registro[c] === 'string' && /^[=+@\-']/.test(registro[c]) ? "'" + registro[c] : registro[c])]);
      SpreadsheetApp.flush();
    }
    // Guardar primero la intención permite completar tras un corte, incluso al recargar.
    if (registro.gastoJson) escribirGasto_(JSON.parse(registro.gastoJson));
    return { id: registro.id, yaRegistrada };
  } finally { lock.releaseLock(); }
}
