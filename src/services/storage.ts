import { Trial, Dog, SheetsConfig } from '../types';
import { OFFICIAL_DILUTION_TABLE, DEFAULT_WEBHOOK_URL } from '../constants/dilutions';
import { evaluateBlockStatus } from '../utils/tdsMetrics';

const STORAGE_KEYS = {
  TRIALS: 'canine_thresholds_trials_v3',
  DOGS: 'canine_thresholds_dogs_v2',
  SHEETS_CONFIG: 'canine_thresholds_sheets_config_v2',
  SESSION_DEFAULTS: 'canine_thresholds_session_defaults_v3',
};

const DEFAULT_DOGS: Dog[] = [
  { id: 'dog-kat', name: "K'at", handlerDefault: 'Carlos', breed: 'Sprocker' },
];

const LEGACY_DEMO_IDS = new Set(['dog-1', 'dog-2', 'dog-3']);
const LEGACY_DEMO_NAMES = new Set(['Kira', 'Thor', 'Max']);

export interface SessionDefaults {
  dogId: string;
  handler: string;
  judge: string;
  sessionDate: string;
  sessionTurn: 'Mañana' | 'Tarde';
  dilutionId: string;
  currentBlockNumber?: number;
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function loadDogs(): Dog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DOGS);
    if (!raw) {
      saveDogs(DEFAULT_DOGS);
      return DEFAULT_DOGS;
    }
    const parsed: Dog[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      saveDogs(DEFAULT_DOGS);
      return DEFAULT_DOGS;
    }
    // Limpiar automáticamente los perros de demostración antiguos (Kira, Thor, Max)
    const cleaned = parsed.filter(
      (d) => !(LEGACY_DEMO_IDS.has(d.id) && LEGACY_DEMO_NAMES.has(d.name))
    );
    const finalDogs = cleaned.length > 0 ? cleaned : DEFAULT_DOGS;
    if (cleaned.length !== parsed.length || finalDogs !== parsed) {
      saveDogs(finalDogs);
    }
    return finalDogs;
  } catch (e) {
    console.error('Error al cargar perros:', e);
    return DEFAULT_DOGS;
  }
}

export function saveDogs(dogs: Dog[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DOGS, JSON.stringify(dogs));
  } catch (e) {
    console.error('Error al guardar perros:', e);
  }
}

export function loadTrials(): Trial[] {
  try {
    // Limpiar versiones anteriores de pruebas
    localStorage.removeItem('canine_thresholds_trials_v2');
    localStorage.removeItem('canine_thresholds_session_defaults_v2');
    const raw = localStorage.getItem(STORAGE_KEYS.TRIALS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error al cargar pasadas:', e);
    return [];
  }
}

export function saveTrials(trials: Trial[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TRIALS, JSON.stringify(trials));
  } catch (e) {
    console.error('Error al guardar pasadas:', e);
  }
}

export function addTrial(trial: Trial): Trial[] {
  const current = loadTrials();
  const updated = [trial, ...current];
  saveTrials(updated);
  return updated;
}

export function removeTrial(trialId: string): Trial[] {
  const current = loadTrials();
  const updated = current.filter((t) => t.id !== trialId);
  saveTrials(updated);
  return updated;
}

export function updateTrial(updatedTrial: Trial): Trial[] {
  const current = loadTrials();
  const updated = current.map((t) => (t.id === updatedTrial.id ? updatedTrial : t));
  saveTrials(updated);
  return updated;
}

export function loadSheetsConfig(): SheetsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SHEETS_CONFIG);
    if (!raw) {
      return {
        webhookUrl: DEFAULT_WEBHOOK_URL,
        autoSync: true,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      webhookUrl: parsed.webhookUrl?.trim() ? parsed.webhookUrl.trim() : DEFAULT_WEBHOOK_URL,
      autoSync: parsed.autoSync !== false,
      lastSyncedAt: parsed.lastSyncedAt,
    };
  } catch (e) {
    return {
      webhookUrl: DEFAULT_WEBHOOK_URL,
      autoSync: true,
    };
  }
}

export function saveSheetsConfig(config: SheetsConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SHEETS_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Error al guardar configuración de sheets:', e);
  }
}

export function loadSessionDefaults(): SessionDefaults {
  const today = getTodayDateString();
  const hour = new Date().getHours();
  const turn: 'Mañana' | 'Tarde' = hour < 14 ? 'Mañana' : 'Tarde';
  const dogs = loadDogs();
  const firstDog = dogs[0];

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION_DEFAULTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      const validDilution = OFFICIAL_DILUTION_TABLE.some((l) => l.id === parsed.dilutionId)
        ? parsed.dilutionId
        : OFFICIAL_DILUTION_TABLE[0].id;
      const validDog = dogs.find((d) => d.id === parsed.dogId) || firstDog;
      const updatedDefaults: SessionDefaults = {
        ...parsed,
        dogId: validDog?.id || 'dog-kat',
        handler: validDog?.handlerDefault || parsed.handler || 'Carlos',
        dilutionId: validDilution,
        sessionDate: today,
        sessionTurn: turn,
      };
      saveSessionDefaults(updatedDefaults);
      return updatedDefaults;
    }
  } catch (e) {
    // ignore
  }

  return {
    dogId: firstDog?.id || 'dog-kat',
    handler: firstDog?.handlerDefault || 'Carlos',
    judge: 'Juez ciego 1',
    sessionDate: today,
    sessionTurn: turn,
    dilutionId: OFFICIAL_DILUTION_TABLE[0].id,
    currentBlockNumber: 1,
  };
}

export function saveSessionDefaults(defaults: SessionDefaults): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSION_DEFAULTS, JSON.stringify(defaults));
  } catch (e) {
    console.error('Error al guardar sesión:', e);
  }
}

/**
 * Obtiene el progreso del bloque actual (1 al 10) para el perro y nivel actual.
 * Si se indica targetBlockNumber (por ejemplo al iniciar un bloque nuevo),
 * devuelve el estado limpio de ese bloque concreto sin arrastrar los resultados del anterior.
 */
export function getBlockProgress(
  trials: Trial[],
  dogId: string,
  dilutionId: string,
  targetBlockNumber?: number
) {
  const matchingTrials = trials
    .filter((t) => t.dogId === dogId && t.dilutionId === dilutionId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Agrupar por bloque y evaluar con la regla unificada (exactitud ≥ 80% y sensibilidad ≥ 80%)
  const blockMap = new Map<number, Trial[]>();
  for (const t of matchingTrials) {
    const bNum = t.blockNumber || 1;
    if (!blockMap.has(bNum)) blockMap.set(bNum, []);
    blockMap.get(bNum)!.push(t);
  }

  let passedBlocksCount = 0;
  for (const [, bTrials] of blockMap) {
    if (evaluateBlockStatus(bTrials).passed) {
      passedBlocksCount++;
    }
  }

  const isLevelMastered = passedBlocksCount >= 2;

  if (matchingTrials.length === 0) {
    const initialBlock = targetBlockNumber || 1;
    return {
      blockNumber: initialBlock,
      roundInBlock: 1,
      trialsInCurrentBlock: [] as Trial[],
      isBlockComplete: false,
      blockHits: 0,
      blockPassed: false,
      blockSensitivity: null as number | null,
      passedBlocksCount: 0,
      isLevelMastered: false,
    };
  }

  // Si se fuerza un bloque específico (ej. al pulsar "Iniciar nuevo bloque"), usamos ese
  const lastTrial = matchingTrials[matchingTrials.length - 1];
  const activeBlockNum = targetBlockNumber ?? (lastTrial.blockNumber || 1);

  const currentBlockTrials = blockMap.get(activeBlockNum) || [];
  const evalStatus = evaluateBlockStatus(currentBlockTrials);

  if (currentBlockTrials.length < 10) {
    return {
      blockNumber: activeBlockNum,
      roundInBlock: currentBlockTrials.length + 1,
      trialsInCurrentBlock: currentBlockTrials,
      isBlockComplete: false,
      blockHits: evalStatus.hits,
      blockPassed: false,
      blockSensitivity: evalStatus.metrics.sensitivity,
      passedBlocksCount,
      isLevelMastered,
    };
  } else {
    return {
      blockNumber: activeBlockNum,
      roundInBlock: 10,
      trialsInCurrentBlock: currentBlockTrials.slice(0, 10),
      isBlockComplete: true,
      blockHits: evalStatus.hits,
      blockPassed: evalStatus.passed,
      blockSensitivity: evalStatus.metrics.sensitivity,
      passedBlocksCount,
      isLevelMastered,
    };
  }
}

/**
 * Carga un bloque de 10 pasadas de ejemplo para probar el sistema de bloques
 */
export function loadSampleTrials(): Trial[] {
  const today = getTodayDateString();
  const sample: Trial[] = [
    // Bloque 1 - Solución madre (Stock: 1:1.000) - 10 rondas (100% de aciertos: 10 de 10)
    { id: 's1', timestamp: new Date(Date.now() - 3600000 * 5.0).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'stock', blockNumber: 1, roundInBlock: 1, isBlank: false, realPosition: 3, markedPosition: 3, resultOutcome: 'VP', syncedToSheets: true },
    { id: 's2', timestamp: new Date(Date.now() - 3600000 * 4.9).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'stock', blockNumber: 1, roundInBlock: 2, isBlank: false, realPosition: 7, markedPosition: 7, resultOutcome: 'VP', syncedToSheets: true },
    { id: 's3', timestamp: new Date(Date.now() - 3600000 * 4.8).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'stock', blockNumber: 1, roundInBlock: 3, isBlank: true, realPosition: 0, markedPosition: 0, resultOutcome: 'VN', syncedToSheets: true },
    { id: 's4', timestamp: new Date(Date.now() - 3600000 * 4.7).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'stock', blockNumber: 1, roundInBlock: 4, isBlank: false, realPosition: 1, markedPosition: 1, resultOutcome: 'VP', syncedToSheets: true },
    { id: 's5', timestamp: new Date(Date.now() - 3600000 * 4.6).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'stock', blockNumber: 1, roundInBlock: 5, isBlank: true, realPosition: 0, markedPosition: 0, resultOutcome: 'VN', syncedToSheets: true },
    { id: 's6', timestamp: new Date(Date.now() - 3600000 * 4.5).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'stock', blockNumber: 1, roundInBlock: 6, isBlank: false, realPosition: 4, markedPosition: 4, resultOutcome: 'VP', syncedToSheets: true },
    { id: 's7', timestamp: new Date(Date.now() - 3600000 * 4.4).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'stock', blockNumber: 1, roundInBlock: 7, isBlank: false, realPosition: 6, markedPosition: 6, resultOutcome: 'VP', syncedToSheets: true },
    { id: 's8', timestamp: new Date(Date.now() - 3600000 * 4.3).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'stock', blockNumber: 1, roundInBlock: 8, isBlank: false, realPosition: 2, markedPosition: 2, resultOutcome: 'VP', syncedToSheets: true },
    { id: 's9', timestamp: new Date(Date.now() - 3600000 * 4.2).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'stock', blockNumber: 1, roundInBlock: 9, isBlank: false, realPosition: 8, markedPosition: 8, resultOutcome: 'VP', syncedToSheets: true },
    { id: 's10', timestamp: new Date(Date.now() - 3600000 * 4.1).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'stock', blockNumber: 1, roundInBlock: 10, isBlank: false, realPosition: 5, markedPosition: 5, resultOutcome: 'VP', syncedToSheets: true },

    // Bloque 1 - Nivel 2 (1:100.000) - 10 rondas (80% aciertos: 8 de 10 -> alcanza umbral)
    { id: 's11', timestamp: new Date(Date.now() - 3600000 * 3.0).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'lvl-2', blockNumber: 1, roundInBlock: 1, isBlank: false, realPosition: 4, markedPosition: 4, resultOutcome: 'VP', syncedToSheets: true },
    { id: 's12', timestamp: new Date(Date.now() - 3600000 * 2.9).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'lvl-2', blockNumber: 1, roundInBlock: 2, isBlank: false, realPosition: 6, markedPosition: 6, resultOutcome: 'VP', syncedToSheets: true },
    { id: 's13', timestamp: new Date(Date.now() - 3600000 * 2.8).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'lvl-2', blockNumber: 1, roundInBlock: 3, isBlank: false, realPosition: 1, markedPosition: 0, resultOutcome: 'FN', syncedToSheets: true },
    { id: 's14', timestamp: new Date(Date.now() - 3600000 * 2.7).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'lvl-2', blockNumber: 1, roundInBlock: 4, isBlank: true, realPosition: 0, markedPosition: 0, resultOutcome: 'VN', syncedToSheets: true },
    { id: 's15', timestamp: new Date(Date.now() - 3600000 * 2.6).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'lvl-2', blockNumber: 1, roundInBlock: 5, isBlank: false, realPosition: 3, markedPosition: 3, resultOutcome: 'VP', syncedToSheets: true },
    { id: 's16', timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'lvl-2', blockNumber: 1, roundInBlock: 6, isBlank: false, realPosition: 7, markedPosition: 7, resultOutcome: 'VP', syncedToSheets: true },
    { id: 's17', timestamp: new Date(Date.now() - 3600000 * 2.4).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'lvl-2', blockNumber: 1, roundInBlock: 7, isBlank: false, realPosition: 5, markedPosition: 5, resultOutcome: 'VP', syncedToSheets: true },
    { id: 's18', timestamp: new Date(Date.now() - 3600000 * 2.3).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'lvl-2', blockNumber: 1, roundInBlock: 8, isBlank: false, realPosition: 2, markedPosition: 2, resultOutcome: 'VP', syncedToSheets: true },
    { id: 's19', timestamp: new Date(Date.now() - 3600000 * 2.2).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'lvl-2', blockNumber: 1, roundInBlock: 9, isBlank: false, realPosition: 8, markedPosition: 0, resultOutcome: 'FN', syncedToSheets: true },
    { id: 's20', timestamp: new Date(Date.now() - 3600000 * 2.1).toISOString(), dogId: 'dog-1', handler: 'Carlos', judge: 'Juez ciego 1', sessionDate: today, sessionTurn: 'Mañana', dilutionId: 'lvl-2', blockNumber: 1, roundInBlock: 10, isBlank: false, realPosition: 3, markedPosition: 3, resultOutcome: 'VP', syncedToSheets: true },
  ];

  saveTrials(sample);
  return sample;
}
