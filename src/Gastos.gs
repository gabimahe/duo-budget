const CATEGORIAS = ['Alquiler', 'Expensas', 'Luz', 'Gas', 'Impuestos', 'Supermercado', 'Farmacia', 'Limpieza', 'Electrodomésticos', 'Otros'];
const COLUMNAS = ['id', 'creadoEn', 'fecha', 'descripcion', 'categoria', 'pagadorId', 'espacioId', 'moneda', 'montoCentavos', 'division', 'persona1Porcentaje', 'persona2Porcentaje', 'persona1Centavos', 'persona2Centavos', 'categoriaDetalle', 'comentario'];

/** Ejecutar desde el editor si Google requiere renovar los permisos de Sheets. */
function autorizarSheets() {
  exigirMiembro_();
  SpreadsheetApp.getActiveSpreadsheet();
  console.log('Permiso de Sheets disponible. Volvé a abrir Dúo para guardar el gasto.');
}

function obtenerOpciones() {
  exigirMiembro_();
  return { categorias: CATEGORIAS, fecha: Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd') };
}

function montoCentavos_(valor) {
  const monto = String(valor || '').trim().replace(/^\$\s*/, '');
  if (!/^(?:\d{1,9}|\d{1,3}(?:\.\d{3}){1,2})(?:,\d{1,2})?$/.test(monto)) throw new Error('Ingresá un monto como $1.000.000,00. Usá coma para los decimales y puntos para los miles.');
  const partes = monto.replace(/\./g, '').split(',');
  const centavos = Number(partes[0]) * 100 + Number((partes[1] || '').padEnd(2, '0'));
  if (centavos <= 0) throw new Error('El monto debe ser mayor a cero.');
  return centavos;
}

function validarGasto_(dato) {
  if (!dato || !/^[a-zA-Z0-9-]{16,80}$/.test(dato.id || '')) throw new Error('Identificador inválido. Recargá la página.');
  const centavos = montoCentavos_(dato.monto);
  const descripcion = String(dato.descripcion || '').trim();
  const comentario = String(dato.comentario ?? '').trim();
  if (comentario.length > 500) throw new Error('El comentario admite hasta 500 caracteres.');
  if (!descripcion || descripcion.length > 200) throw new Error('La descripción debe tener entre 1 y 200 caracteres.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dato.fecha || '') || !Number.isFinite(Date.parse(dato.fecha)) || new Date(dato.fecha).toISOString().slice(0, 10) !== dato.fecha) throw new Error('Ingresá una fecha válida.');
  if (!CATEGORIAS.includes(dato.categoria)) throw new Error('Seleccioná una categoría válida.');
  const categoriaDetalle = dato.categoria === 'Otros' ? String(dato.categoriaDetalle || '').trim() : '';
  if (dato.categoria === 'Otros' && (!categoriaDetalle || categoriaDetalle.length > 100)) throw new Error('Especificá la categoría de Otros con entre 1 y 100 caracteres.');
  if (!['persona1', 'persona2'].includes(dato.pagador)) throw new Error('Seleccioná quién pagó.');
  if (dato.espacio !== 'convivencia') throw new Error('Espacio inválido.');
  if (!['mitad', 'invitacion', 'otro'].includes(dato.division)) throw new Error('Seleccioná cómo se divide.');
  let porcentaje = 50;
  if (dato.division === 'invitacion') porcentaje = dato.pagador === 'persona1' ? 100 : 0;
  if (dato.division === 'otro') {
    const valor = String(dato.porcentajePersona1 ?? '').replace(',', '.');
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(valor) || Number(valor) > 100) throw new Error('El porcentaje de Persona1 debe estar entre 0 y 100, con hasta dos decimales.');
    porcentaje = Number(valor);
  }
  const partePersona1 = Math.floor((centavos * Math.round(porcentaje * 100)) / 10000);
  return { id: dato.id, fecha: dato.fecha, descripcion, comentario, categoria: dato.categoria, categoriaDetalle, pagador: dato.pagador, division: dato.division, centavos, porcentaje, partePersona1, partePersona2: centavos - partePersona1 };
}

function asegurarColumnas_(hoja) {
  const cabeceras = hoja.getRange(1, 1, 1, COLUMNAS.length).getValues()[0];
  // Admitir los esquemas previos de 14 y 15 columnas, sin modificar filas existentes.
  const primeraVacia = cabeceras.indexOf('');
  const cantidad = primeraVacia === -1 ? COLUMNAS.length : primeraVacia;
  if (![14, 15, 16].includes(cantidad) || JSON.stringify(cabeceras.slice(0, cantidad)) !== JSON.stringify(COLUMNAS.slice(0, cantidad)) || cabeceras.slice(cantidad).some(valor => valor !== '')) {
    throw new Error('Las columnas de Movimientos fueron modificadas. Revisá la planilla antes de guardar.');
  }
  if (cantidad < COLUMNAS.length) hoja.getRange(1, cantidad + 1, 1, COLUMNAS.length - cantidad).setValues([COLUMNAS.slice(cantidad)]);
}

/** Escribe una sola vez cada solicitud, incluso si se reintenta tras un error de red. */
function guardarGasto(dato) {
  exigirMiembro_();
  if (/^(fijo|bien)-/.test(String(dato && dato.id || ''))) throw new Error('Registrá esta operación desde su sección.');
  const gasto = validarGasto_(dato);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return escribirGasto_(gasto);
  } finally { lock.releaseLock(); }
}

// Requiere el bloqueo de script adquirido por quien llama.
function escribirGasto_(gasto) {
    const propiedades = PropertiesService.getScriptProperties();
    let id = propiedades.getProperty('DUO_SPREADSHEET_ID');
    let libro;
    if (!id) throw new Error('Falta la planilla de esta instalación. Revisá la configuración antes de guardar.');
    libro = SpreadsheetApp.openById(id);
    let hoja = libro.getSheetByName('Movimientos');
    if (!hoja) hoja = libro.insertSheet('Movimientos');
    if (hoja.getLastRow() === 0) {
      hoja.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]);
      hoja.setFrozenRows(1);
    }
    asegurarColumnas_(hoja);
    const filas = hoja.getLastRow();
    const existente = filas > 1 && hoja.getRange(2, 1, filas - 1, 1).createTextFinder(gasto.id).matchEntireCell(true).findNext();
    if (!existente) {
      // El apóstrofo evita interpretar una descripción como fórmula de Sheets.
      const descripcion = /^[=+@\-']/.test(gasto.descripcion) ? "'" + gasto.descripcion : gasto.descripcion;
      const detalle = /^[=+@\-']/.test(gasto.categoriaDetalle) ? "'" + gasto.categoriaDetalle : gasto.categoriaDetalle;
      const comentario = /^[=+@\-']/.test(gasto.comentario) ? "'" + gasto.comentario : gasto.comentario;
      const fila = [gasto.id, new Date().toISOString(), gasto.fecha, descripcion, gasto.categoria, gasto.pagador, 'convivencia', 'ARS', gasto.centavos, gasto.division, gasto.porcentaje, (10000 - Math.round(gasto.porcentaje * 100)) / 100, gasto.partePersona1, gasto.partePersona2, detalle, comentario];
      hoja.getRange(filas + 1, 1, 1, COLUMNAS.length).setValues([fila]);
      SpreadsheetApp.flush();
    }
    return { id: gasto.id, url: libro.getUrl() };
}
