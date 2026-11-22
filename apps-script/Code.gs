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

    var existingIds = {};
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var idValues = sheet.getRange(2, 16, lastRow - 1, 1).getValues();
      for (var k = 0; k < idValues.length; k++) {
        var existingId = String(idValues[k][0] || '').trim();
        if (existingId) existingIds[existingId] = true;
      }
    }

    var newRows = [];
    for (var i = 0; i < rowsToInsert.length; i++) {
      var item = rowsToInsert[i];
      var rowId = String(item.Id_Pasada || item.ID_Registro || '').trim();
      if (rowId && existingIds[rowId]) continue;
      if (rowId) existingIds[rowId] = true;
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
        rowId
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

function formatDateCell(val, tz) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
  }
  return val !== undefined && val !== null ? String(val) : '';
}

function formatTimestampCell(val) {
  if (val instanceof Date) {
    return val.toISOString();
  }
  return val !== undefined && val !== null ? String(val) : '';
}

function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : '';
    if (action === 'get_trials') {
      var sheet = getOrCreateSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          count: 0,
          data: []
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var tz = Session.getScriptTimeZone() || 'UTC';
      var values = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
      var rows = [];
      for (var i = 0; i < values.length; i++) {
        var r = values[i];
        if (!r[0] && !r[12] && !r[15]) continue;
        rows.push({
          ID_Perro: String(r[0] || ''),
          Guia: String(r[1] || ''),
          Preparador_Juez: String(r[2] || ''),
          Fecha_Sesion: formatDateCell(r[3], tz),
          Turno: String(r[4] || ''),
          Nivel_Dilucion: String(r[5] || ''),
          Dilucion_Teorica: String(r[6] || ''),
          Bloque: Number(r[7]) || 1,
          Ronda_En_Bloque: Number(r[8]) || 1,
          Es_Blanco: String(r[9] || ''),
          Posicion_Real: Number(r[10]) || 0,
          Posicion_Marcada: Number(r[11]) || 0,
          Resultado: String(r[12] || ''),
          Timestamp: formatTimestampCell(r[13]),
          Notas: String(r[14] || ''),
          Id_Pasada: String(r[15] || '')
        });
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        count: rows.length,
        data: rows
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'online',
      message: 'Webhook de umbrales olfativos activo y listo.'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
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
