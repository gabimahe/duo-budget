# Dúo · Un bugdet de parejas -

Una base minimalista para administrar los gastos de un hogar de dos personas. Cada instalación funciona en la cuenta Google de quien la instala, con su propia planilla y su propio enlace.

> Dúo es una base para uso personal. Cada persona debe instalarla y autorizarla con su propia cuenta de Google. Durante la configuración inicial, Dúo crea y vincula automáticamente una hoja de cálculo en esa cuenta. Descargar este repositorio no otorga acceso a ninguna aplicación, cuenta ni planilla del autor.

## Qué incluye

- Gastos, historial, balance y registro de pagos entre dos personas.
- Reparto 50/50, invitación (quien paga asume todo) u otro porcentaje.
- Gastos fijos por período y patrimonio, sin duplicar movimientos.
- Nombres y nombre del hogar configurables durante la bienvenida.
- Invitación opcional a la segunda persona. Sin invitación, quien administra registra los gastos de ambas.
- Interfaz responsive lavanda, importes argentinos y almacenamiento en centavos.

Esta primera versión usa pesos argentinos, zona horaria de Buenos Aires y dos integrantes. No importa datos de otras instalaciones, no conecta bancos y no realiza pagos bancarios. No incluye presupuestos con límites ni alertas de exceso. Las categorías se personalizan en `src/Gastos.gs`; los estilos, en `src/Index.html`.

## Instalá tu propia copia

Hacé esta configuración una sola vez, desde una computadora. Después podrás abrir tu Dúo desde el celular usando tu enlace.

Vas a descargar los archivos, llevarlos a tu cuenta Google y abrir la aplicación. **Dúo creará la planilla al terminar: no la crees antes.**

La guía principal usa **Windows y Visual Studio Code**. Necesitás tu cuenta Google y permiso para instalar programas en la computadora. Usá la misma cuenta Google durante todos los pasos. Si es una cuenta del trabajo o de estudio, su organización podría limitar Apps Script.

### 1. Prepará la computadora

**Dónde: en tu navegador.**

Instalá estos dos programas si todavía no los tenés:

- [Node.js](https://nodejs.org/en/download): elegí la versión marcada **LTS** y el instalador para Windows. Incluye npm, que usaremos más adelante.
- [Visual Studio Code](https://code.visualstudio.com/download): elegí Windows e instalalo. Es el programa donde abriremos los archivos y ejecutaremos los comandos.

Cuando termines, cerrá y volvé a abrir Visual Studio Code para que reconozca Node.js.

**Listo cuando:** podés abrir Visual Studio Code. Para seguir esta guía mediante ZIP no necesitás instalar Git ni iniciar sesión en GitHub.

### 2. Descargá y abrí los archivos de Dúo

**Dónde: primero en GitHub; después en Visual Studio Code.**

1. En la página de este repositorio, tocá el botón **Code → Download ZIP**.
2. En Descargas, hacé clic derecho sobre el ZIP y elegí **Extraer todo**. Abrí la carpeta extraída.
3. En Visual Studio Code, elegí **File → Open Folder** / **Archivo → Abrir carpeta**.
4. Seleccioná la carpeta que contiene `README.md`, `.clasp.example.json` y `src`. Puede estar dentro de otra carpeta con el mismo nombre.

**Listo cuando:** ves esos archivos en la columna izquierda de VS Code. Trabajá con la carpeta extraída, no dentro del ZIP.

### 3. Creá tu proyecto en Google

**Dónde: en el navegador.**

1. Abrí [Google Apps Script](https://script.google.com/). Es el servicio que alojará tu aplicación.
2. Revisá la foto de perfil arriba a la derecha: debe ser la cuenta donde querés guardar tus datos.
3. Tocá **Nuevo proyecto**.
4. Cambiá «Proyecto sin título» por **Dúo — Mi hogar**.
5. Entrá al engranaje **Configuración del proyecto**.
6. Buscá **ID de secuencia de comandos** / **Script ID** y copialo.

**Listo cuando:** tenés un proyecto nuevo y copiaste su ID. Dejá esta pestaña abierta; volveremos a ella.

### 4. Conectá los archivos con ese proyecto

**Dónde: en Visual Studio Code.**

1. En la columna izquierda, abrí `.clasp.example.json`.
2. Elegí **File → Save As** / **Archivo → Guardar como**.
3. Guardalo en la misma carpeta con el nombre exacto **`.clasp.json`**. Conservá el punto inicial y no agregues `.txt`.
4. En ese archivo nuevo, reemplazá `REEMPLAZAR_POR_EL_ID_DE_TU_PROYECTO` por el ID que copiaste en el paso 3. Conservá las comillas.
5. Guardá con **Ctrl + S**.

La estructura debe quedar así; donde dice `TU_ID_COPIADO` debe estar el identificador real:

```json
{
  "scriptId": "TU_ID_COPIADO",
  "rootDir": "src"
}
```

**Listo cuando:** ves `.clasp.json` junto a `.clasp.example.json`, y el archivo nuevo contiene tu ID. Este paso conecta el proyecto de Apps Script; todavía no hay una planilla.

### 5. Autorizá la herramienta que sube los archivos

**Dónde: en VS Code y, cuando se abra, en el navegador.**

En VS Code elegí **Terminal → New Terminal** / **Terminal → Nueva terminal**. Se abrirá un panel abajo. Seleccioná **PowerShell** si te pide elegir una terminal.

Pegá cada comando en ese panel, presioná **Enter** y esperá a que termine antes de continuar.

Primero comprobá que Node.js esté disponible:

```powershell
node --version
```

Debe aparecer una versión que comienza con `v`. Después instalá **clasp**, la herramienta de Google que envía los archivos a Apps Script:

```powershell
npm.cmd install -g @google/clasp
```

La instalación agrega clasp a tu computadora. Ahora, en el navegador, abrí [la configuración de Apps Script](https://script.google.com/home/usersettings) con la misma cuenta del paso 3 y activá **API de Google Apps Script**.

Volvé a la terminal y ejecutá:

```powershell
clasp.cmd login
```

Se abrirá Google para elegir una cuenta y revisar los permisos. Elegí **la cuenta del paso 3** y completá la autorización. Esto permite que clasp gestione tu proyecto; la autorización para usar Dúo llegará al abrir la aplicación.

**Listo cuando:** la terminal confirma que iniciaste sesión. Si un comando muestra un error, consultá [Si algo no sale como esperabas](#si-algo-no-sale-como-esperabas) antes de continuar.

### 6. Subí Dúo a tu proyecto

**Dónde: en la misma terminal de VS Code.**

Ejecutá:

```powershell
clasp.cmd status
```

Debe listar archivos de `src`, como `Index.html`, `Acceso.gs` e `Instalacion.gs`. Este comando solo muestra qué se enviará.

Comprobá que `.clasp.json` tenga el ID del **proyecto nuevo** del paso 3. Después ejecutá:

```powershell
clasp.cmd push
```

Si pregunta si querés enviar el manifiesto `appsscript.json`, confirmá con `y` y Enter. El envío reemplaza el contenido del proyecto vinculado, por eso usamos uno nuevo.

Volvé a la pestaña del editor de Apps Script y recargala.

**Listo cuando:** los archivos de Dúo aparecen en el editor de Google. Subirlos todavía no crea el enlace para usar la aplicación.

### 7. Indicá quién administra esta copia

**Dónde: en el editor de Google Apps Script.**

1. Entrá a **Configuración del proyecto**, con el engranaje.
2. Bajá hasta **Propiedades de la secuencia de comandos** / **Script properties**.
3. Tocá **Agregar propiedad** y completá:

| Campo | Qué escribir |
|---|---|
| Propiedad | `DUO_ADMIN_EMAIL` |
| Valor | Tu correo Google completo, el mismo usado en los pasos anteriores. |

Guardá las propiedades. No escribas una contraseña.

**Listo cuando:** `DUO_ADMIN_EMAIL` aparece guardado con tu correo. Dúo permitirá que solo esa cuenta complete la primera configuración.

### 8. Creá el enlace de tu aplicación

**Dónde: en el editor de Google Apps Script.**

1. Arriba a la derecha, tocá **Implementar → Nueva implementación**.
2. En **Seleccionar tipo**, tocá el engranaje y elegí **Aplicación web**. No elijas Biblioteca.
3. Completá estas opciones:

| Opción | Valor |
|---|---|
| Descripción | `Primera versión de Dúo` |
| Ejecutar como | **Usuario que accede a la aplicación web** |
| Quién tiene acceso | **Cualquier usuario con una cuenta de Google** |

4. Tocá **Implementar** y completá la autorización si Google la solicita.
5. Copiá la **URL de la aplicación web**, que termina en `/exec`.

La opción de acceso permite llegar a la pantalla de entrada con Google. Dúo verifica por separado quién puede configurar el hogar o consultar sus datos.

**Listo cuando:** tenés tu enlace terminado en `/exec`. Guardalo en favoritos: ese será el acceso desde la computadora y el celular.

### 9. Creá tu espacio y empezá a usarlo

**Dónde: en tu enlace nuevo de Dúo, desde el navegador.**

1. Abrí el enlace con la cuenta que guardaste en `DUO_ADMIN_EMAIL`.
2. Si Google pide autorización, revisá y aceptá los permisos de identidad y Sheets. El acceso a Sheets solicitado es amplio: [consultá qué permite](#permisos-y-privacidad).
3. En la bienvenida, dejá **Dúo — Mi hogar** o elegí otro nombre para tu espacio y su planilla.
4. Escribí tu nombre y el de la otra persona, usando nombres distintos.
5. Tocá **Crear mi espacio** y esperá a que termine.

**Listo cuando:** aparece el inicio de Dúo y encontrás la nueva planilla en [Google Drive](https://drive.google.com/) con el nombre que elegiste. Dúo prepara las pestañas y guarda la conexión automáticamente.

Ya podés cargar un gasto desde **Nuevo gasto** y comprobarlo en **Gastos** y **Balance**. Al cerrar y volver a abrir tu enlace, se conserva el espacio: no tenés que repetir la instalación.

## Si algo no sale como esperabas

| Lo que ves | Qué hacer |
|---|---|
| `node` o `clasp.cmd` no se reconoce | Cerrá y volvé a abrir VS Code. Para `node`, comprobá el paso 1; para `clasp.cmd`, comprobá que terminó la instalación del paso 5. |
| No se encuentra `.clasp.json` | Revisá el nombre del archivo y que esté junto al README. Abrí esa carpeta en VS Code y creá una terminal nueva allí. |
| La API de Apps Script está deshabilitada | Activala desde el enlace del paso 5 con la misma cuenta que usaste en `clasp.cmd login`. Después reintentá `clasp.cmd push`. |
| Google no puede abrir el archivo o entra con otra cuenta | Usá un perfil de navegador con solo tu cuenta de instalación, o una ventana privada e iniciá sesión con ella. Abrí la URL que termina en `/exec`. |
| Dúo dice que tu cuenta no tiene acceso | Compará el correo mostrado en Dúo con `DUO_ADMIN_EMAIL`. Corregí y guardá la propiedad si corresponde; después tocá **Volver a comprobar acceso**. |
| Google indica que la aplicación no está verificada o está bloqueada | Revisá los permisos y la cuenta del proyecto. Algunas instalaciones requieren configuración o verificación adicional de Google; consultá [Permisos y privacidad](#permisos-y-privacidad). Un bloqueo no se resuelve cambiando la aplicación para que se ejecute como su propietario. |
| La creación anterior no pudo confirmarse | Seguí [la recuperación de la configuración](#si-se-interrumpe-la-primera-configuración). No crees otro proyecto ni borres propiedades para reintentar. |

Los nombres de los menús pueden variar según el idioma de tu cuenta. Si pedís ayuda, compartí el paso y el mensaje de error, sin contraseñas ni tokens.

<details>
<summary>Si usás macOS/Linux o preferís clonar con Git</summary>

En macOS/Linux, instalá Node.js LTS y VS Code para tu sistema. En los comandos usá `npm` y `clasp` en lugar de `npm.cmd` y `clasp.cmd`. Los pasos en Google son los mismos.

Si ya usás Git, podés reemplazar la descarga del ZIP del paso 2 por:

```sh
git clone https://github.com/gabimahe/duo-publico.git
cd duo-publico
```

Después abrí esa carpeta en VS Code y continuá en el paso 3.

</details>

Referencias oficiales: [terminal de VS Code](https://code.visualstudio.com/docs/terminal/getting-started), [clasp](https://github.com/google/clasp), [aplicaciones web de Apps Script](https://developers.google.com/apps-script/guides/web).


## Acceso compartido opcional

Desde **Mi cuenta**, quien administra puede crear una invitación para la otra persona. Debe enviarla por su cuenta: Dúo no envía mensajes. La invitación vence en 48 horas y es de un solo uso. Después de aceptarla, la persona administradora revisa y confirma el correo. Solo entonces se comparte la planilla como editor y se habilita el acceso a los datos.

No compartas el proyecto de Apps Script con quien solo necesita usar la aplicación. Quien recibe acceso a la planilla puede editar sus datos directamente; evitá modificar cabeceras o identificadores. Cancelar una invitación pendiente no revoca a una persona ya incorporada.

## Permisos y privacidad

La aplicación solicita `userinfo.email` para identificar la cuenta y `spreadsheets` para crear y gestionar los datos. Este último permiso tiene alcance sobre tus planillas, aunque el código trabaja con el ID configurado para esta instalación. No solicita leer correos Gmail. La variante de menor alcance `drive.file` todavía no está implementada.

Cada instalación administra su propia autorización. Google puede mostrar advertencias de aplicación no verificada o exigir verificación según el uso y el público. Consultá [autorizaciones](https://developers.google.com/apps-script/guides/authorization) y [cuotas](https://developers.google.com/apps-script/guides/services/quotas). Publicar código no equivale a verificar las aplicaciones creadas con él.

El código no incluye telemetría ni una conexión con los datos del autor. Google sigue procesando los datos mediante sus servicios. No subas `.clasp.json`, `.clasprc.json`, tokens, propiedades de Apps Script ni exportaciones de tus gastos. El `.gitignore` excluye configuraciones locales comunes; revisá siempre los archivos antes de publicarlos.

## Si se interrumpe la primera configuración

Si ya se guardó el identificador de la planilla, volvé a intentar: se completa la misma instalación con los nombres originales, sin duplicarla. No borres propiedades para empezar de nuevo.

Si aparece **La creación anterior no pudo confirmarse**, puede haberse creado el archivo sin que se haya guardado su ID. Como excepción de recuperación:

1. Revisá tu Google Drive y buscá el nombre que elegiste.
2. Si el archivo existe, verificá que sea la planilla nueva de Dúo, de tu propiedad. Copiá su ID desde la URL y agregalo a la propiedad `DUO_SPREADSHEET_ID` del proyecto. Reintentá en la bienvenida.
3. Si confirmaste que no se creó ningún archivo, editá el JSON de `DUO_INSTALACION` para quitar solo `creacionIniciada` y reintentá. Si no estás seguro, no lo hagas: podrías crear un duplicado.

La recuperación es manual solo ante este fallo excepcional; el recorrido normal crea y vincula todo automáticamente.

## Desarrollo y actualizaciones

El backend está en `src/*.gs` y la interfaz en `src/Index.html`. El manifiesto está en `src/appsscript.json`. No hay dependencias de runtime de npm ni compilación.

```powershell
node --test
```

Los tests usan servicios simulados y no escriben datos reales. Antes de usar esta versión con datos importantes, probá en tu instalación: crear el espacio, recargar sin crear otra planilla, guardar un gasto, consultar su balance y, si corresponde, invitar a la segunda cuenta. La autorización real de Google no puede comprobarse con tests locales.

Para actualizar, respaldá tu planilla, revisá los cambios y sincronizá con `clasp.cmd push`. Luego editá tu implementación para usar una versión nueva. No reemplaces tus propiedades ni tu `.clasp.json` con las de otro proyecto. Las personalizaciones pueden requerir resolver conflictos al incorporar actualizaciones. Esta base usa un esquema independiente y no migra automáticamente otras versiones de Dúo.

## Pagar un gasto específico

En Balance → Registrar pago, elegí quién pagó y el gasto. Dúo sugiere el pendiente calculado con el reparto original, descontando pagos ya asociados. Podés registrar un importe menor. Un pago a un gasto puede superar la deuda neta y cambiar quién le debe a quién. Los pagos generales (incluidos los históricos) siguen afectando el balance, pero no se asignan automáticamente a gastos. Solo registrá pagos que realmente ocurrieron.

La hoja Transferencias agrega movimientoId al final al guardar el primer pago de esta versión. Se conservan las filas anteriores. Respaldá la planilla antes de actualizar.
