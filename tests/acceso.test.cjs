const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
function entorno() {
  let correo = 'owner@example.com', efectivo = null, ahora = 100000, bloqueado = false, compartirFalla = false;
  const props = { DUO_SPREADSHEET_ID: 'duo-sheet', DUO_ADMIN_EMAIL: 'owner@example.com' }, compartidos = [];
  const c = vm.createContext({ Date: class extends Date { static now() { return ahora; } },
    Session: { getActiveUser: () => ({ getEmail: () => correo }), getEffectiveUser: () => ({ getEmail: () => efectivo === null ? correo : efectivo }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { assert.equal(bloqueado, true); props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() { assert.equal(bloqueado, false); bloqueado = true; }, releaseLock() { bloqueado = false; } }) },
    Utilities: { getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (_, s) => Array.from(crypto.createHash('sha256').update(s).digest()) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/example/exec' }) },
    SpreadsheetApp: { openById(id) { assert.equal(id, 'duo-sheet'); return { getOwner: () => ({ getEmail: () => 'owner@example.com' }), addEditor(email) { assert.equal(bloqueado, true); assert.equal(correo, 'owner@example.com'); if (compartirFalla) throw Error('No se pudo compartir'); compartidos.push(email); } }; } }
  });
  for (const n of ['Instalacion', 'Acceso', 'Gastos', 'Historial', 'Balance', 'Fijos', 'Inicio', 'Patrimonio']) vm.runInContext(fs.readFileSync('src/' + n + '.gs', 'utf8'), c);
  return { c, props, compartidos, como: x => { correo = x; }, efectivo: x => { efectivo = x; }, avanzar: ms => { ahora += ms; }, falla: v => { compartirFalla = v; } };
}
const token = r => new URLSearchParams(new URL(r.url).hash.slice(1)).get('invitacion');
test('el despliegue exige Google y ejecuta como visitante con scopes explícitos', () => {
  const manifest = JSON.parse(fs.readFileSync('src/appsscript.json', 'utf8'));
  assert.equal(manifest.webapp.executeAs, 'USER_ACCESSING');
  assert.equal(manifest.webapp.access, 'ANYONE');
  assert.deepEqual(manifest.oauthScopes.sort(), ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/userinfo.email']);
});
function configurar(e) {
  if (!e.c.esAdministradorInstalacion_(e.c.correoActual_())) throw Error('No autorizado');
  e.props.DUO_ACCESO_V1 = JSON.stringify({ propietario: 'owner@example.com', miembros: [{ correo: 'owner@example.com', persona: 'persona1' }], invitacion: null });
}

test('solo la cuenta propietaria puede configurar y no se permite suplantar la sesión', () => {
  const e = entorno(); e.como('intruso@example.com');
  assert.equal(e.c.obtenerAcceso().estado, 'sin-acceso'); assert.throws(() => configurar(e));
  e.como('owner@example.com'); assert.equal(e.c.obtenerAcceso().estado, 'configurar'); configurar(e);
  assert.equal(e.c.obtenerAcceso().persona, 'persona1');
  assert.equal(e.c.configurarInstalacion({}).existente, true);
  e.como('intruso@example.com'); e.efectivo('owner@example.com'); assert.throws(() => e.c.obtenerAcceso(), /identificar/);
  e.como(''); e.efectivo(''); assert.throws(() => e.c.exigirMiembro_());
});
test('invitar, aceptar, confirmar y compartir solo con la cuenta autenticada', () => {
  const e = entorno(); configurar(e); const invitacion = e.c.crearInvitacion(), secreto = token(invitacion);
  assert.equal(invitacion.persona, 'persona2'); assert.equal(e.props.DUO_ACCESO_V1.includes(secreto), false);
  assert.throws(() => e.c.aceptarInvitacion(secreto), /otra persona/);
  e.como('persona2@example.com'); e.c.aceptarInvitacion(secreto); e.c.aceptarInvitacion(secreto);
  assert.equal(e.c.obtenerAcceso().estado, 'pendiente'); assert.throws(() => e.c.exigirMiembro_()); assert.equal(e.compartidos.length, 0);
  assert.throws(() => e.c.crearInvitacion()); assert.throws(() => e.c.confirmarInvitacion('x', 'persona2@example.com'));
  e.como('intruso@example.com'); assert.throws(() => e.c.aceptarInvitacion(secreto), /utilizada/);
  e.como('owner@example.com'); const p = e.c.obtenerAcceso().pendiente;
  assert.throws(() => e.c.confirmarInvitacion(p.id, 'otro@example.com'));
  e.c.confirmarInvitacion(p.id, p.correo); assert.deepEqual(e.compartidos, ['persona2@example.com']);
  e.como('persona2@example.com'); assert.equal(e.c.exigirMiembro_().persona, 'persona2'); assert.equal(e.c.obtenerAcceso().admin, false);
  assert.throws(() => e.c.aceptarInvitacion(secreto)); assert.throws(() => e.c.revocarInvitacion());
  e.como('owner@example.com'); assert.throws(() => e.c.crearInvitacion(), /dos personas/);
});
test('vencimiento, reemplazo y revocación invalidan el enlace y la solicitud anterior', () => {
  const e = entorno(); configurar(e); const viejo = token(e.c.crearInvitacion());
  const nuevo = token(e.c.crearInvitacion()); e.como('persona1@example.com'); assert.throws(() => e.c.aceptarInvitacion(viejo));
  e.avanzar(48 * 60 * 60 * 1000); assert.throws(() => e.c.aceptarInvitacion(nuevo), /venció/);
  e.como('owner@example.com'); const vigente = token(e.c.crearInvitacion());
  e.como('persona1@example.com'); e.c.aceptarInvitacion(vigente); e.como('owner@example.com'); const p = e.c.obtenerAcceso().pendiente;
  e.c.revocarInvitacion(); assert.throws(() => e.c.confirmarInvitacion(p.id, p.correo));
  e.como('persona1@example.com'); assert.equal(e.c.obtenerAcceso().estado, 'sin-acceso'); assert.throws(() => e.c.aceptarInvitacion(vigente));
});
test('un fallo al compartir conserva la solicitud y no habilita acceso prematuramente', () => {
  const e = entorno(); configurar(e); const secreto = token(e.c.crearInvitacion());
  e.como('persona2@example.com'); e.c.aceptarInvitacion(secreto); e.como('owner@example.com'); const p = e.c.obtenerAcceso().pendiente;
  e.falla(true); assert.throws(() => e.c.confirmarInvitacion(p.id, p.correo)); e.como('persona2@example.com'); assert.throws(() => e.c.exigirMiembro_());
  e.como('owner@example.com'); e.falla(false); e.c.confirmarInvitacion(p.id, p.correo); assert.equal(e.compartidos.length, 1);
});
test('todos los endpoints de datos rechazan visitantes y pendientes antes de leer Sheets', () => {
  const e = entorno(); configurar(e); const secreto = token(e.c.crearInvitacion());
  e.como('intruso@example.com');
  const funciones = ['autorizarSheets', 'obtenerOpciones', 'guardarGasto', 'listarGastos', 'obtenerBalance', 'guardarTransferencia', 'listarFijos', 'guardarFijo', 'pagarFijo', 'copiarFijos', 'listarPatrimonio', 'opcionesVincularPatrimonio', 'guardarPatrimonio', 'obtenerInicio'];
  e.c.SpreadsheetApp = { openById() { assert.fail('No debe leer la planilla'); }, create() { assert.fail('No debe crear archivos'); } };
  for (const funcion of funciones) assert.throws(() => e.c[funcion]({ correo: 'owner@example.com', persona: 'persona1' }), /todavía no tiene acceso/);
  e.c.aceptarInvitacion(secreto);
  for (const funcion of funciones) assert.throws(() => e.c[funcion](), /todavía no tiene acceso/);
  const publicas = fs.readdirSync('src').filter(f => f.endsWith('.gs') && !['Instalacion.gs', 'Acceso.gs', 'Code.gs'].includes(f)).flatMap(f => Array.from(fs.readFileSync('src/' + f, 'utf8').matchAll(/^function (\w+)\(/gm), m => m[1]).filter(n => !n.endsWith('_')));
  assert.deepEqual(publicas.sort(), funciones.sort());
});
