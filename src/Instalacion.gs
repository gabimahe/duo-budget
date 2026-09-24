// La cuenta instaladora define DUO_ADMIN_EMAIL en las propiedades del script.
// Nunca se acepta un administrador enviado desde el navegador.
function esAdministradorInstalacion_(correo) {
  const esperado = PropertiesService.getScriptProperties().getProperty('DUO_ADMIN_EMAIL');
  return !!esperado && esperado.trim().toLowerCase() === correo;
}

function configurarInstalacion(dato) {
  const correo = correoActual_();
  if (!esAdministradorInstalacion_(correo)) throw new Error('Solo la cuenta administradora de esta instalación puede crear el espacio.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    if (configAcceso_()) return { ok: true, existente: true };
    const texto = (valor, etiqueta) => {
      const v = String(valor || '').trim();
      if (!v || v.length > 60) throw new Error(etiqueta + ' debe tener entre 1 y 60 caracteres.');
      return v;
    };
    let pendiente = props.getProperty('DUO_INSTALACION');
    if (pendiente) pendiente = JSON.parse(pendiente);
    else {
      const nombre = texto(dato && dato.nombre, 'El nombre del espacio');
      const persona1 = texto(dato && dato.persona1, 'Tu nombre');
      const persona2 = texto(dato && dato.persona2, 'El nombre de la otra persona');
      if (persona1.toLowerCase() === persona2.toLowerCase()) throw new Error('Usá nombres distintos para identificar a cada persona.');
      pendiente = { nombre, nombres: { persona1, persona2 } };
      props.setProperty('DUO_INSTALACION', JSON.stringify(pendiente));
    }
    let id = props.getProperty('DUO_SPREADSHEET_ID');
    let libro;
    if (id) {
      libro = SpreadsheetApp.openById(id);
      if (libro.getOwner().getEmail().trim().toLowerCase() !== correo) throw new Error('La planilla debe pertenecer a la cuenta administradora.');
    } else {
      // Un corte después de crear en Drive puede dejar el resultado incierto.
      // No se crea otro archivo a ciegas: el README explica la recuperación.
      if (pendiente.creacionIniciada) throw new Error('La creación anterior no pudo confirmarse. Revisá Google Drive y seguí la recuperación del README antes de reintentar. No creamos otra planilla.');
      pendiente.creacionIniciada = true;
      props.setProperty('DUO_INSTALACION', JSON.stringify(pendiente));
      libro = SpreadsheetApp.create(pendiente.nombre);
      props.setProperty('DUO_SPREADSHEET_ID', libro.getId());
    }
    libro.setSpreadsheetTimeZone('America/Argentina/Buenos_Aires');
    for (const [nombre, columnas] of [['Movimientos', COLUMNAS], ['GastosFijos', COLUMNAS_FIJOS], ['Patrimonio', COLUMNAS_PATRIMONIO], ['Transferencias', COLUMNAS_TRANSFERENCIAS]]) {
      let hoja = libro.getSheetByName(nombre);
      if (!hoja) hoja = libro.insertSheet(nombre);
      if (!hoja.getLastRow()) { hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]); hoja.setFrozenRows(1); }
      else if (JSON.stringify(hoja.getRange(1, 1, 1, columnas.length).getValues()[0]) !== JSON.stringify(columnas)) throw new Error('La estructura de ' + nombre + ' no coincide. No se modificaron sus datos.');
    }
    SpreadsheetApp.flush();
    guardarConfigAcceso_({ propietario: correo, nombre: pendiente.nombre, nombres: pendiente.nombres, miembros: [{ correo, persona: 'persona1' }], invitacion: null });
    return { ok: true, existente: false };
  } finally { lock.releaseLock(); }
}
