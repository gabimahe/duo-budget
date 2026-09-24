const COLUMNAS_FIJOS = ['id', 'serieId', 'mes', 'vencimiento', 'descripcion', 'categoria', 'categoriaDetalle', 'montoCentavos', 'espacioId'];

function validarMesFijo_(mes) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '')) throw new Error('Seleccioná un mes válido.');
}
function leerFijos_(libro) {
  const hoja = libro && libro.getSheetByName('GastosFijos');
  if (!hoja || !hoja.getLastRow()) return [];
  const datos = hoja.getDataRange().getValues();
  if (!COLUMNAS_FIJOS.every((c, i) => datos[0][i] === c)) throw new Error('Revisá las cabeceras de GastosFijos.');
  return datos.slice(1).filter(f => f[0] && f[8] === 'convivencia').map(f => Object.fromEntries(COLUMNAS_FIJOS.map((c, i) => [c, f[i] instanceof Date ? Utilities.formatDate(f[i], 'America/Argentina/Buenos_Aires', c === 'mes' ? 'yyyy-MM' : 'yyyy-MM-dd') : f[i]])));
}
function estadoFijos_(fijos, gastos, mes, hoy) {
  const movimientos = new Map(gastos.map(g => [g.id, g]));
  return fijos.filter(f => f.mes === mes).map(f => {
    const pago = movimientos.get('fijo-' + f.id);
    return Object.assign({}, f, { estado: pago ? 'pagado' : f.vencimiento < hoy ? 'vencido' : 'pendiente', pago: pago ? { fecha: pago.fecha, montoCentavos: pago.montoCentavos, pagadorId: pago.pagadorId } : null });
  }).sort((a, b) => Number(a.estado === 'pagado') - Number(b.estado === 'pagado') || a.vencimiento.localeCompare(b.vencimiento) || a.descripcion.localeCompare(b.descripcion));
}
function listarFijos(mes) {
  exigirMiembro_();
  validarMesFijo_(mes);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const id = PropertiesService.getScriptProperties().getProperty('DUO_SPREADSHEET_ID');
    const libro = id ? SpreadsheetApp.openById(id) : null;
    return estadoFijos_(leerFijos_(libro), libro ? leerDatosBalance_(libro).gastos : [], mes, Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd'));
  } finally { lock.releaseLock(); }
}
function libroFijos_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('DUO_SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('Falta la planilla de esta instalación. Revisá la configuración antes de guardar.');
}
function escribirFijos_(libro, filas) {
  if (!filas.length) return;
  let hoja = libro.getSheetByName('GastosFijos');
  if (!hoja) hoja = libro.insertSheet('GastosFijos');
  if (!hoja.getLastRow()) { hoja.getRange(1, 1, 1, COLUMNAS_FIJOS.length).setValues([COLUMNAS_FIJOS]); hoja.setFrozenRows(1); }
  const valores = filas.map(f => COLUMNAS_FIJOS.map(c => typeof f[c] === 'string' && /^[=+@\-']/.test(f[c]) ? "'" + f[c] : f[c]));
  hoja.getRange(hoja.getLastRow() + 1, 1, valores.length, COLUMNAS_FIJOS.length).setValues(valores);
  SpreadsheetApp.flush();
}
function guardarFijo(dato) {
  exigirMiembro_();
  if (!dato) throw new Error('Completá la obligación.');
  validarMesFijo_(dato.mes);
  const g = validarGasto_(Object.assign({}, dato, { fecha: dato.vencimiento, pagador: 'persona1', division: 'mitad', espacio: 'convivencia' }));
  if (g.descripcion.length > 180 || g.id.length > 64) throw new Error('El nombre admite hasta 180 caracteres y el identificador hasta 64.');
  if (g.fecha.slice(0, 7) !== dato.mes) throw new Error('El vencimiento debe estar dentro del mes de la obligación.');
  const f = { id: g.id, serieId: g.id, mes: dato.mes, vencimiento: g.fecha, descripcion: g.descripcion, categoria: g.categoria, categoriaDetalle: g.categoriaDetalle, montoCentavos: g.centavos, espacioId: 'convivencia' };
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const libro = libroFijos_(); const filas = leerFijos_(libro);
    const existente = filas.find(x => x.id === f.id);
    if (existente) {
      if (COLUMNAS_FIJOS.some(c => existente[c] !== f[c])) throw new Error('Esta solicitud ya se guardó con otros datos. Actualizá la lista.');
      return { id: f.id };
    }
    if (filas.some(x => x.mes === f.mes && x.descripcion.trim().toLowerCase() === f.descripcion.toLowerCase())) throw new Error('Ya existe una obligación con ese nombre en el mes. Revisá la lista.');
    escribirFijos_(libro, [f]); return { id: f.id };
  } finally { lock.releaseLock(); }
}
function pagarFijo(dato) {
  exigirMiembro_();
  if (!dato || !/^[a-zA-Z0-9-]{16,72}$/.test(dato.id || '')) throw new Error('Obligación inválida.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const id = PropertiesService.getScriptProperties().getProperty('DUO_SPREADSHEET_ID');
    if (!id) throw new Error('No encontramos la obligación.');
    const libro = SpreadsheetApp.openById(id);
    const fijo = leerFijos_(libro).find(f => f.id === dato.id);
    if (!fijo) throw new Error('No encontramos la obligación.');
    // El movimiento es la única fuente del estado pagado. No hay segunda escritura.
    const anterior = leerDatosBalance_(libro).gastos.find(g => g.id === 'fijo-' + fijo.id);
    if (anterior) return { id: anterior.id, yaPagado: true };
    const g = validarGasto_(Object.assign({}, dato, { id: 'fijo-' + fijo.id, descripcion: fijo.descripcion + ' · ' + fijo.mes, categoria: fijo.categoria, categoriaDetalle: fijo.categoriaDetalle, espacio: 'convivencia' }));
    const hoy = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
    if (g.fecha > hoy) throw new Error('La fecha de un pago realizado no puede ser futura.');
    return escribirGasto_(g);
  } finally { lock.releaseLock(); }
}
function prepararCopiaFijos_(filas, mes) {
  validarMesFijo_(mes);
  const [anio, numero] = mes.split('-').map(Number);
  const anterior = numero === 1 ? (anio - 1) + '-12' : anio + '-' + String(numero - 1).padStart(2, '0');
  const ultimoDia = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
  const existentes = filas.filter(f => f.mes === mes);
  return filas.filter(f => f.mes === anterior && !existentes.some(e => e.serieId === f.serieId || e.descripcion.trim().toLowerCase() === f.descripcion.trim().toLowerCase())).map(f => Object.assign({}, f, { id: f.serieId + '-' + mes, mes, vencimiento: mes + '-' + String(Math.min(Number(f.vencimiento.slice(-2)), ultimoDia)).padStart(2, '0') }));
}
function copiarFijos(mes) {
  exigirMiembro_();
  validarMesFijo_(mes);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const id = PropertiesService.getScriptProperties().getProperty('DUO_SPREADSHEET_ID');
    if (!id) return { cantidad: 0 };
    const libro = SpreadsheetApp.openById(id);
    const nuevas = prepararCopiaFijos_(leerFijos_(libro), mes);
    escribirFijos_(libro, nuevas); return { cantidad: nuevas.length };
  } finally { lock.releaseLock(); }
}
