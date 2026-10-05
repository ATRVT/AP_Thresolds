import { Trial, Dog, DilutionLevel } from '../types';
import { getTrialOutcome } from '../utils/tdsMetrics';

export interface SyncResult {
  success: boolean;
  message: string;
  count?: number;
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

  const rows = trials.map((t) => formatTrialForSheet(t, dogsMap, levelsMap));

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

    if (response.type === 'opaque' || response.ok) {
      return {
        success: true,
        message: `Sincronizadas ${rows.length} pasadas exitosamente con Google Sheets.`,
        count: rows.length,
      };
    }

    const text = await response.text();
    return {
      success: false,
      message: `Respuesta del servidor: ${text.slice(0, 100)}`,
    };
  } catch (error: any) {
    console.error('Error al sincronizar con webhook:', error);
    return {
      success: false,
      message: `Error de conexión: ${error.message || 'Compruebe su conexión a internet'}`,
    };
  }
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

  const rows = trials.map((t) => {
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
