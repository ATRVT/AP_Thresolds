/**
 * Script para Google Sheets: Registro de umbrales olfativos caninos
 * 
 * Instrucciones:
 * 1. En tu Google Sheet, ve a: Extensiones -> Apps Script.
 * 2. Borra el código actual y pega este contenido.
 * 3. Haz clic en "Implementar" -> "Nueva implementación".
 * 4. Selecciona: "Aplicación web".
 *    - Ejecutar como: "Yo"
 *    - Quién tiene acceso: "Cualquiera" (Anyone)
 * 5. Copia la URL generada y pégala en Ajustes de la aplicación.
 */

function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);

    var contents = e.postData.contents;
    var parsed = JSON.parse(contents);
    var rowsToInsert = [];

    if (parsed.action === 'sync_trials' && Array.isArray(parsed.data)) {
      rowsToInsert = parsed.data;
    } else if (Array.isArray(parsed)) {
      rowsToInsert = parsed;
    } else if (parsed.ID_Perro) {
      rowsToInsert = [parsed];
    }

    var sheet = getOrCreateSheet();

    if (sheet.getLastRow() === 0) {
      setupHeaders(sheet);
    }

    var newRows = [];
    for (var i = 0; i < rowsToInsert.length; i++) {
      var item = rowsToInsert[i];
      newRows.push([
        item.ID_Perro || '',
        item.Guia || '',
        item.Preparador_Juez || '',
        item.Fecha_Sesion || '',
        item.Turno || '',
        item.Nivel_Dilucion || '',
        item.Dilucion_Teorica || '',
        item.Bloque || 1,
        item.Ronda_En_Bloque || 1,
        item.Es_Blanco || '',
        item.Posicion_Real !== undefined ? item.Posicion_Real : '',
        item.Posicion_Marcada !== undefined ? item.Posicion_Marcada : '',
        item.Resultado || item.Resultado_TDS || '',
        item.Timestamp || new Date().toISOString(),
        item.Notas || '',
        item.Id_Pasada || ''
      ]);
    }

    if (newRows.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, newRows.length, newRows[0].length).setValues(newRows);
    }

    lock.releaseLock();

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      inserted: newRows.length,
      message: 'Datos guardados correctamente'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    message: 'Webhook de umbrales olfativos activo y listo.'
  })).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "Registro_Umbrales";
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function setupHeaders(sheet) {
  var headers = [
    "ID_Perro",
    "Guía",
    "Preparador_Juez",
    "Fecha_Sesión",
    "Turno",
    "Nivel_Dilución",
    "Dilución_Teórica",
    "Bloque",
    "Ronda_Bloque",
    "Es_Blanco",
    "Posición_Real",
    "Posición_Marcada",
    "Resultado",
    "Timestamp",
    "Notas",
    "ID_Registro"
  ];
  
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#FA963D");
  headerRange.setFontColor("#ffffff");
  sheet.setFrozenRows(1);
}
