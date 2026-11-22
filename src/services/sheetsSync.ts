import { Trial, Dog, DilutionLevel, ResultOutcome } from '../types';
import { getTrialOutcome, calculateResultOutcome } from '../utils/tdsMetrics';

export interface SyncResult {
  success: boolean;
  message: string;
  count?: number;
}

export interface FetchTrialsResult {
  success: boolean;
  message: string;
  trials?: Trial[];
  discoveredDogs?: Dog[];
  needsScriptUpdate?: boolean;
}

/**
 * Prepara el formato de fila exacto para Google Sheets y CSV
 */
export function formatTrialForSheet(
  trial: Trial,
  dogsMap: Map<string, Dog>,
  levelsMap: Map<string, DilutionLevel>
) {
  const dog = dogsMap.get(trial.dogId);
  const level = levelsMap.get(trial.dilutionId);
  const outcome = getTrialOutcome(trial);

  return {
    ID_Perro: dog ? dog.name : trial.dogId,
    Guia: trial.handler,
    Preparador_Juez: trial.judge,
    Fecha_Sesion: trial.sessionDate,
    Turno: trial.sessionTurn,
    Nivel_Dilucion: level ? level.name : trial.dilutionId,
    Dilucion_Teorica: level ? level.theoreticalRatio : '',
    Bloque: trial.blockNumber || 1,
    Ronda_En_Bloque: trial.roundInBlock || 1,
    Es_Blanco: trial.isBlank ? 'SÍ' : 'NO',
    Posicion_Real: trial.realPosition,
    Posicion_Marcada: trial.markedPosition,
    Resultado: outcome,
    Timestamp: trial.timestamp,
    Notas: trial.notes || '',
    Id_Pasada: trial.id,
  };
}

/**
 * Ordena las pasadas cronológicamente (ronda 1 -> ronda 10)
 */
function sortTrialsChronologically(trials: Trial[]): Trial[] {
  return [...trials].sort((a, b) => {
    const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    if (timeDiff !== 0) return timeDiff;
    const blockDiff = (a.blockNumber || 1) - (b.blockNumber || 1);
    if (blockDiff !== 0) return blockDiff;
    return (a.roundInBlock || 1) - (b.roundInBlock || 1);
  });
}

/**
 * Envía una lista de pasadas al Webhook de Google Apps Script
 */
export async function syncTrialsToWebhook(
  trials: Trial[],
  dogs: Dog[],
  levels: DilutionLevel[],
  webhookUrl: string
): Promise<SyncResult> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return {
      success: false,
      message: 'Dirección de webhook no configurada o inválida.',
    };
  }

  const dogsMap = new Map(dogs.map((d) => [d.id, d]));
  const levelsMap = new Map(levels.map((l) => [l.id, l]));

  const orderedTrials = sortTrialsChronologically(trials);
  const rows = orderedTrials.map((t) => formatTrialForSheet(t, dogsMap, levelsMap));

  try {
    const response = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'sync_trials',
        data: rows,
      }),
    });

    if (response.type === 'opaque') {
      return {
        success: true,
        message: `Sincronizadas ${rows.length} pasadas con Google Sheets.`,
        count: rows.length,
      };
    }

    const text = await response.text();
    if (!response.ok) {
      return {
        success: false,
        message: `Error HTTP ${response.status}: ${text.slice(0, 120)}`,
      };
    }

    try {
      const parsed = JSON.parse(text);
      if (parsed.status === 'error') {
        return {
          success: false,
          message: `Error en Google Sheets: ${parsed.message || 'Error desconocido'}`,
        };
      }
      if (parsed.status === 'success' || parsed.status === 'online') {
        const insertedCount = typeof parsed.inserted === 'number' ? parsed.inserted : rows.length;
        return {
          success: true,
          message: `Sincronizadas ${insertedCount} pasadas exitosamente con Google Sheets.`,
          count: insertedCount,
        };
      }
    } catch {
      // Si Apps Script devolvió HTML de error/permisos en lugar de JSON
      if (text.toLowerCase().includes('<html')) {
        return {
          success: false,
          message: 'El script de Google devolvió una página HTML en lugar de JSON. Verifica los permisos ("Cualquiera").',
        };
      }
    }

    return {
      success: true,
      message: `Sincronizadas ${rows.length} pasadas exitosamente con Google Sheets.`,
      count: rows.length,
    };
  } catch (error: any) {
    console.error('Error al sincronizar con webhook:', error);
    return {
      success: false,
      message: `Error de conexión: ${error.message || 'Compruebe su conexión a internet'}`,
    };
  }
}

function normalizeDateString(raw: unknown): string {
  const s = String(raw || '').trim();
  if (!s) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function normalizeTimestamp(raw: unknown, fallbackDate: string): string {
  const s = String(raw || '').trim();
  if (s) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return `${fallbackDate}T12:00:00.000Z`;
}

function resolveDilutionId(rawName: unknown, rawRatio: unknown, levels: DilutionLevel[]): string {
  const name = String(rawName || '').trim().toLowerCase();
  const ratio = String(rawRatio || '').trim().toLowerCase();
  const found = levels.find(
    (l) =>
      l.id.toLowerCase() === name ||
      l.name.toLowerCase() === name ||
      (ratio && l.theoreticalRatio.toLowerCase() === ratio)
  );
  return found ? found.id : levels[0]?.id || 'stock';
}

/**
 * Descarga todas las pasadas almacenadas en Google Sheets mediante doGet (?action=get_trials)
 */
export async function fetchTrialsFromWebhook(
  webhookUrl: string,
  existingDogs: Dog[],
  levels: DilutionLevel[]
): Promise<FetchTrialsResult> {
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return {
      success: false,
      message: 'Dirección de webhook no configurada o inválida.',
    };
  }

  const baseUrl = webhookUrl.trim();
  const separator = baseUrl.includes('?') ? '&' : '?';
  const fetchUrl = `${baseUrl}${separator}action=get_trials`;

  try {
    const response = await fetch(fetchUrl, { method: 'GET' });
    const text = await response.text();

    if (!response.ok) {
      return {
        success: false,
        message: `Error HTTP ${response.status} al leer Google Sheets.`,
      };
    }

    if (text.toLowerCase().includes('<html')) {
      return {
        success: false,
        message: 'Google Apps Script devolvió HTML. Verifica que la implementación tenga acceso "Cualquiera".',
      };
    }

    const parsed = JSON.parse(text);
    if (parsed.status === 'online') {
      return {
        success: false,
        needsScriptUpdate: true,
        message:
          'Tu Apps Script actual no incluye lectura (doGet). Actualiza Code.gs desde Ajustes e implementa una nueva versión.',
      };
    }

    if (parsed.status === 'error') {
      return {
        success: false,
        message: `Error en Google Sheets: ${parsed.message || 'Error desconocido'}`,
      };
    }

    if (parsed.status !== 'success' || !Array.isArray(parsed.data)) {
      return {
        success: false,
        message: 'Respuesta inesperada de Google Sheets.',
      };
    }

    const dogsByName = new Map(existingDogs.map((d) => [d.name.trim().toLowerCase(), d]));
    const dogsById = new Map(existingDogs.map((d) => [d.id, d]));
    const discoveredDogs: Dog[] = [];

    const validOutcomes = new Set<ResultOutcome>(['VP', 'FP', 'VN', 'FN']);

    const trials: Trial[] = parsed.data.map((row: any, idx: number) => {
      const rawDog = String(row.ID_Perro || '').trim() || "K'at";
      let dog = dogsById.get(rawDog) || dogsByName.get(rawDog.toLowerCase());
      if (!dog) {
        const newId = `dog-${rawDog.toLowerCase().replace(/[^a-z0-9]+/g, '-') || idx}`;
        dog = {
          id: newId,
          name: rawDog,
          handlerDefault: String(row.Guia || '').trim() || undefined,
        };
        dogsByName.set(rawDog.toLowerCase(), dog);
        dogsById.set(newId, dog);
        discoveredDogs.push(dog);
      }

      const sessionDate = normalizeDateString(row.Fecha_Sesion);
      const timestamp = normalizeTimestamp(row.Timestamp, sessionDate);
      const dilutionId = resolveDilutionId(row.Nivel_Dilucion, row.Dilucion_Teorica, levels);
      const blockNumber = Number(row.Bloque) || 1;
      const roundInBlock = Number(row.Ronda_En_Bloque ?? row.Ronda_Bloque) || 1;
      const realPosition = Number(row.Posicion_Real) || 0;
      const markedPosition = Number(row.Posicion_Marcada) || 0;
      const blankStr = String(row.Es_Blanco || '').trim().toUpperCase();
      const isBlank =
        blankStr === 'SÍ' ||
        blankStr === 'SI' ||
        blankStr === 'TRUE' ||
        row.Es_Blanco === true ||
        realPosition === 0;

      const rawOutcome = String(row.Resultado || row.Resultado_TDS || '').trim().toUpperCase() as ResultOutcome;
      const resultOutcome: ResultOutcome = validOutcomes.has(rawOutcome)
        ? rawOutcome
        : calculateResultOutcome(isBlank, realPosition, markedPosition);

      const id =
        String(row.Id_Pasada || row.ID_Registro || '').trim() ||
        `sheet_${dog.id}_${dilutionId}_${blockNumber}_${roundInBlock}_${timestamp}`;

      return {
        id,
        timestamp,
        dogId: dog.id,
        handler: String(row.Guia || '').trim(),
        judge: String(row.Preparador_Juez || '').trim(),
        sessionDate,
        sessionTurn: row.Turno === 'Tarde' ? 'Tarde' : 'Mañana',
        dilutionId,
        blockNumber,
        roundInBlock,
        isBlank,
        realPosition,
        markedPosition,
        resultOutcome,
        notes: String(row.Notas || '').trim() || undefined,
        syncedToSheets: true,
      };
    });

    return {
      success: true,
      message: `Descargadas ${trials.length} pasadas desde Google Sheets.`,
      trials,
      discoveredDogs,
    };
  } catch (error: any) {
    console.error('Error al leer desde webhook:', error);
    return {
      success: false,
      message: `Error al descargar de Sheets: ${error.message || 'Compruebe su conexión'}`,
    };
  }
}

/**
 * Combina pasadas de Google Sheets con pasadas locales pendientes sin duplicar por ID.
 * Ordena de más reciente a más antigua para mantener consistencia con addTrial().
 */
export function mergeTrialsFromSheets(localTrials: Trial[], remoteTrials: Trial[]): Trial[] {
  const byId = new Map<string, Trial>();
  for (const t of remoteTrials) {
    byId.set(t.id, { ...t, syncedToSheets: true });
  }
  for (const t of localTrials) {
    if (!byId.has(t.id) && !t.syncedToSheets) {
      byId.set(t.id, t);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Exporta las pasadas a un archivo CSV descargable
 */
export function exportTrialsToCSV(
  trials: Trial[],
  dogs: Dog[],
  levels: DilutionLevel[]
): void {
  const dogsMap = new Map(dogs.map((d) => [d.id, d]));
  const levelsMap = new Map(levels.map((l) => [l.id, l]));

  const headers = [
    'ID_Perro',
    'Guía',
    'Preparador_Juez',
    'Fecha_Sesión',
    'Turno',
    'Nivel_Dilución',
    'Dilución_Teórica',
    'Bloque',
    'Ronda',
    'Es_Blanco',
    'Posición_Real',
    'Posición_Marcada',
    'Resultado',
    'Timestamp',
    'Notas',
  ];

  const rows = sortTrialsChronologically(trials).map((t) => {
    const f = formatTrialForSheet(t, dogsMap, levelsMap);
    return [
      `"${f.ID_Perro}"`,
      `"${f.Guia}"`,
      `"${f.Preparador_Juez}"`,
      `"${f.Fecha_Sesion}"`,
      `"${f.Turno}"`,
      `"${f.Nivel_Dilucion}"`,
      `"${f.Dilucion_Teorica}"`,
      f.Bloque,
      f.Ronda_En_Bloque,
      `"${f.Es_Blanco}"`,
      f.Posicion_Real,
      f.Posicion_Marcada,
      `"${f.Resultado}"`,
      `"${f.Timestamp}"`,
      `"${(f.Notas || '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `registro_umbrales_caninos_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exporta respaldo completo en JSON
 */
export function exportBackupJSON(trials: Trial[], dogs: Dog[]): void {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '2.0',
    dogs,
    trials,
  };
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `respaldo_umbrales_caninos_${new Date().toISOString().slice(0, 10)}.json`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
