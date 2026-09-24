function listarGastos(mes) {
  exigirMiembro_();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '')) throw new Error('Seleccioná un mes válido.');
  const id = PropertiesService.getScriptProperties().getProperty('DUO_SPREADSHEET_ID');
  if (!id) return [];
  const hoja = SpreadsheetApp.openById(id).getSheetByName('Movimientos');
  if (!hoja || hoja.getLastRow() < 2) return [];
  return prepararHistorial_(hoja.getDataRange().getValues(), mes);
}

function prepararHistorial_(datos, mes) {
  const cabeceras = datos[0];
  if (!COLUMNAS.slice(0, 14).every((nombre, i) => cabeceras[i] === nombre)) throw new Error('Revisá las cabeceras de Movimientos: no tienen el formato esperado.');
  return datos.slice(1).filter(fila => fila[0] && fila[6] === 'convivencia').map(fila => {
    const gasto = {};
    cabeceras.forEach((nombre, i) => {
      if (!COLUMNAS.includes(nombre)) return;
      const valor = fila[i];
      gasto[nombre] = valor instanceof Date
        ? (nombre === 'fecha' ? Utilities.formatDate(valor, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd') : valor.toISOString())
        : valor;
    });
    gasto.categoriaDetalle = gasto.categoriaDetalle || '';
    gasto.comentario = gasto.comentario || '';
    return gasto;
  }).filter(gasto => mes === null || String(gasto.fecha).slice(0, 7) === mes)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.creadoEn).localeCompare(String(a.creadoEn)) || String(b.id).localeCompare(String(a.id)));
}
