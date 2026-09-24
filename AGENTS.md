# Dúo · base reutilizable

- Esta es una instalación independiente. Nunca copiar credenciales, IDs, propiedades, enlaces ni datos de otra aplicación.
- Apps Script, Sheets y HTML/CSS/JavaScript sin frameworks. Discutir antes un cambio de stack.
- Cada copia configura su administrador mediante DUO_ADMIN_EMAIL. La identidad siempre proviene de Google en el servidor, nunca de un correo enviado por el cliente.
- Ejecutar como usuario que accede. Cada endpoint de datos exige membresía; crear el espacio exige la cuenta administradora configurada. Invitación a una segunda persona opcional, con aceptación y confirmación administrativa.
- La creación inicial debe ser idempotente. Ante una creación incierta, detener y ofrecer recuperación; no crear otra planilla a ciegas.
- Dos personas con IDs estables persona1/persona2 y nombres configurables. No usar nombres de personas como claves.
- Importes ARS en centavos enteros y presentación argentina. Repartos 50/50, invitación (100 % pagador) y porcentaje personalizado.
- Separar período/vencimiento de una obligación de su pago real. Crear pendientes no genera deuda. Un pago vincula un único movimiento.
- Patrimonio vincula un único movimiento nuevo o existente. Integra balance pero se separa del gasto corriente. No confundir precio de compra con tasación.
- Mobile-first, minimalismo y paleta lavanda. Mostrar los nombres y notas usando textContent; no insertar HTML del usuario.
- Trabajar en hitos pequeños, probar reglas de datos y acceso. No agregar ingresos, Gemini o nuevos servicios sin acordarlos.
- Mantener README e instrucciones de instalación reproducibles. No publicar archivos locales de configuración o datos.
