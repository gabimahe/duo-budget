/** Punto de entrada de la Web App. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Dúo · Nuestro espacio')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
