# Dúo · Un bugdet de parejas

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

## Instalación paso a paso

Necesitás una cuenta Google con Apps Script habilitado. Las cuentas administradas por una organización pueden tener restricciones. Para trabajar localmente: Git, Node.js LTS y clasp.

1. En GitHub, elegí **Code → Download ZIP**, o copiá la dirección HTTPS del repositorio y ejecutá `git clone DIRECCION_COPIADA`. Abrí la carpeta descargada en VS Code.
2. Entrá a [Google Apps Script](https://script.google.com/) con la cuenta que será dueña de tus datos y creá un **proyecto nuevo**. No lo conectes a una aplicación previa.
3. En **Configuración del proyecto**, copiá el **ID de secuencia de comandos**. En tu carpeta local, copiá `.clasp.example.json` como `.clasp.json` y reemplazá el marcador `scriptId` por ese identificador. Este ID corresponde al proyecto, no a una planilla: la planilla se crea después, automáticamente.
4. Instalá y autorizá clasp con esa misma cuenta. Activá la API de Apps Script en [la configuración de Apps Script](https://script.google.com/home/usersettings).

   ```powershell
   npm install -g @google/clasp
   clasp.cmd login
   clasp.cmd status
   clasp.cmd push
   ```

   En macOS/Linux usá `clasp` en lugar de `clasp.cmd`. Revisá que el proyecto vinculado sea el nuevo antes de hacer `push`. La instalación global agrega la herramienta a tu computadora; la autorización se guarda localmente, fuera del repositorio.

5. En el editor web, abrí **Configuración del proyecto → Propiedades de la secuencia de comandos**. Agregá `DUO_ADMIN_EMAIL` con tu correo Google exacto como valor. Esto autoriza la configuración inicial únicamente a tu cuenta. No es una contraseña ni se publica en el repositorio. No copies propiedades de otra instalación.
6. Elegí **Implementar → Nueva implementación → Aplicación web**. Configurá **Ejecutar como: Usuario que accede a la aplicación web** y acceso para **usuarios con cuenta Google**. No uses acceso anónimo ni ejecución como propietario. El código verifica además la pertenencia al hogar en cada operación de datos.
7. Abrí el enlace terminado en `/exec` con tu cuenta administradora y autorizá los permisos de identidad y Sheets. Si tenés varias cuentas abiertas, usá un perfil de navegador separado para evitar confusiones.
8. En la bienvenida, revisá el nombre sugerido **Dúo — Mi hogar**, ingresá tu nombre y el de la otra persona y tocá **Crear mi espacio**. Se creará una planilla en tu cuenta con Movimientos, GastosFijos, Patrimonio y Transferencias. No tenés que crearla ni pegar su identificador.

Al volver a entrar se reutiliza la configuración existente. Los nombres se muestran como texto, sin ejecutar HTML. No cambies manualmente los identificadores `persona1` y `persona2` una vez que tengas movimientos.

Referencias: [clasp](https://developers.google.com/apps-script/guides/clasp), [implementación de aplicaciones web](https://developers.google.com/apps-script/guides/web).

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
