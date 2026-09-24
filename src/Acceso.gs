// Configuración privada del espacio; nunca se envía el hash de invitación al cliente.
const CLAVE_ACCESO = 'DUO_ACCESO_V1';
function correoActual_() {
  const correo = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const efectivo = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!correo || correo !== efectivo) throw new Error('No pudimos identificar tu cuenta. Abrí Dúo con una sola cuenta Google y autorizá el acceso solicitado.');
  return correo;
}
function configAcceso_() {
  const raw = PropertiesService.getScriptProperties().getProperty(CLAVE_ACCESO);
  return raw ? JSON.parse(raw) : null;
}
function guardarConfigAcceso_(config) { PropertiesService.getScriptProperties().setProperty(CLAVE_ACCESO, JSON.stringify(config)); }
function exigirMiembro_() {
  const correo = correoActual_(), config = configAcceso_();
  const miembro = config && config.miembros.find(m => m.correo === correo);
  if (!miembro) throw new Error('Esta cuenta todavía no tiene acceso a Dúo. Necesitás una invitación aceptada y confirmada.');
  return Object.assign({}, miembro, { admin: correo === config.propietario });
}
function exigirAdmin_() {
  const miembro = exigirMiembro_();
  if (!miembro.admin) throw new Error('Solo quien administra Dúo puede gestionar invitaciones.');
  return miembro;
}
function esPropietarioDatos_(correo) {
  const id = PropertiesService.getScriptProperties().getProperty('DUO_SPREADSHEET_ID');
  if (!id) return false;
  try {
    const propietario = SpreadsheetApp.openById(id).getOwner();
    return propietario && propietario.getEmail().trim().toLowerCase() === correo;
  } catch (_) { return false; }
}
function obtenerAcceso() {
  const correo = correoActual_(), config = configAcceso_();
  if (!config) return { estado: esAdministradorInstalacion_(correo) ? 'configurar' : 'sin-acceso', correo };
  const miembro = config.miembros.find(m => m.correo === correo);
  if (miembro) {
    const admin = correo === config.propietario;
    return { estado: 'miembro', correo, persona: miembro.persona, admin, nombre: config.nombre || 'Mi hogar', nombres: config.nombres || { persona1: 'Persona 1', persona2: 'Persona 2' },
      otro: config.miembros.find(m => m.correo !== correo)?.persona || null,
      pendiente: admin && config.invitacion && config.invitacion.solicitante ? { correo: config.invitacion.solicitante, persona: config.invitacion.persona, id: config.invitacion.id } : null,
      invitacionVigente: admin && !!(config.invitacion && !config.invitacion.solicitante && config.invitacion.vence > Date.now()) };
  }
  return { estado: config.invitacion && config.invitacion.solicitante === correo ? 'pendiente' : 'sin-acceso', correo };
}
function hashInvitacion_(token) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8).map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function crearInvitacion() {
  const admin = exigirAdmin_();
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const config = configAcceso_();
    if (config.miembros.length >= 2) throw new Error('Las dos personas ya tienen acceso.');
    const token = Utilities.getUuid() + Utilities.getUuid();
    const vence = Date.now() + 48 * 60 * 60 * 1000;
    config.invitacion = { id: Utilities.getUuid(), hash: hashInvitacion_(token), vence, persona: admin.persona === 'persona1' ? 'persona2' : 'persona1', solicitante: null };
    guardarConfigAcceso_(config);
    return { url: ScriptApp.getService().getUrl() + '#invitacion=' + token, vence, persona: config.invitacion.persona };
  } finally { lock.releaseLock(); }
}
function aceptarInvitacion(token) {
  const correo = correoActual_();
  if (typeof token !== 'string' || !/^[a-zA-Z0-9-]{72}$/.test(token)) throw new Error('La invitación no es válida. Pedí un enlace nuevo.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const config = configAcceso_(), inv = config && config.invitacion;
    if (!inv || inv.hash !== hashInvitacion_(token)) throw new Error('La invitación no es válida o fue reemplazada.');
    if (config.miembros.some(m => m.correo === correo)) throw new Error('Tu cuenta ya tiene acceso. La invitación es para la otra persona.');
    if (inv.solicitante) {
      if (inv.solicitante === correo) return { ok: true };
      throw new Error('Esta invitación ya fue utilizada.');
    }
    if (inv.vence <= Date.now()) throw new Error('La invitación venció. Pedí un enlace nuevo.');
    inv.solicitante = correo; guardarConfigAcceso_(config);
    return { ok: true };
  } finally { lock.releaseLock(); }
}
function confirmarInvitacion(id, correoEsperado) {
  exigirAdmin_();
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const config = configAcceso_(), inv = config.invitacion;
    if (!inv || inv.id !== id || inv.solicitante !== correoEsperado || !inv.solicitante || config.miembros.length >= 2) throw new Error('La solicitud cambió. Actualizá Acceso compartido.');
    const libroId = PropertiesService.getScriptProperties().getProperty('DUO_SPREADSHEET_ID');
    // Se comparte únicamente el archivo de Dúo y con la cuenta verificada por Google.
    SpreadsheetApp.openById(libroId).addEditor(inv.solicitante);
    config.miembros.push({ correo: inv.solicitante, persona: inv.persona }); config.invitacion = null;
    guardarConfigAcceso_(config); return { ok: true };
  } finally { lock.releaseLock(); }
}
function revocarInvitacion() {
  exigirAdmin_();
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { const config = configAcceso_(); config.invitacion = null; guardarConfigAcceso_(config); return { ok: true }; }
  finally { lock.releaseLock(); }
}
