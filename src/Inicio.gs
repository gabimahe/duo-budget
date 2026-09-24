function resumirInicio_(datos, mes) {
  const balance = calcularBalance_(datos.gastos, datos.transferencias);
  const vinculados = new Set((datos.patrimonio || []).map(p => p.movimientoId));
  const delMes = datos.gastos.filter(g => String(g.fecha).slice(0, 7) === mes);
  const compras = delMes.filter(g => vinculados.has(g.id) || String(g.id).startsWith('bien-'));
  const gastos = delMes.filter(g => !vinculados.has(g.id) && !String(g.id).startsWith('bien-'));
  const categorias = new Map();
  let totalCentavos = 0;
  gastos.forEach(g => {
    totalCentavos += g.montoCentavos;
    const nombre = g.categoria || 'Otros';
    categorias.set(nombre, (categorias.get(nombre) || 0) + g.montoCentavos);
  });
  if (!Number.isSafeInteger(totalCentavos)) throw new Error('El total excede el rango admitido.');
  return {
    totalCentavos, cantidad: gastos.length, balance, comprasCentavos: compras.reduce((s, g) => s + g.montoCentavos, 0),
    categorias: Array.from(categorias, ([nombre, centavos]) => ({ nombre, centavos })).sort((a, b) => b.centavos - a.centavos || a.nombre.localeCompare(b.nombre)),
    ultimos: gastos.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.creadoEn).localeCompare(String(a.creadoEn)) || String(b.id).localeCompare(String(a.id))).slice(0, 5)
  };
}

function obtenerInicio(mes) {
  exigirMiembro_();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '')) throw new Error('Seleccioná un mes válido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const id = PropertiesService.getScriptProperties().getProperty('DUO_SPREADSHEET_ID');
    const libro = id ? SpreadsheetApp.openById(id) : null;
    const datos = libro ? leerDatosBalance_(libro) : { gastos: [], transferencias: [] };
    datos.patrimonio = libro ? leerPatrimonio_(libro) : [];
    const resumen = resumirInicio_(datos, mes);
    const fijos = libro ? estadoFijos_(leerFijos_(libro), datos.gastos, mes, Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd')) : [];
    resumen.fijos = { total: fijos.length, pagados: fijos.filter(f => f.estado === 'pagado').length, vencidos: fijos.filter(f => f.estado === 'vencido').length };
    return resumen;
  } finally { lock.releaseLock(); }
}
