export interface DilutionLevel {
  id: string;
  name: string;
  theoreticalRatio: string;
  ratioValue: number;
  stepIndex: number;
  unitLabel?: string;
  unitBoldOption?: string;
}

export type ResultOutcome = 'VP' | 'FP' | 'VN' | 'FN';

export interface Trial {
  id: string;
  timestamp: string; // ISO string
  dogId: string;
  handler: string; // Guía
  judge: string; // Preparador / juez ciego
  sessionDate: string; // YYYY-MM-DD
  sessionTurn: 'Mañana' | 'Tarde';
  dilutionId: string;
  blockNumber: number; // Número de bloque (ej. bloque 1, bloque 2...)
  roundInBlock: number; // Ronda dentro del bloque (1 a 10)
  isBlank: boolean; // ¿Es ronda en blanco?
  realPosition: number; // 0 si es blanco, 1 a 8 si hay diana
  markedPosition: number | string; // Posición o respuesta del perro (0 si no marcó)
  resultOutcome: ResultOutcome;
  notes?: string;
  syncedToSheets?: boolean;
}

export interface Dog {
  id: string;
  name: string;
  handlerDefault?: string;
  breed?: string;
}

export interface ThresholdMetrics {
  vp: number;
  fp: number;
  vn: number;
  fn: number;
  totalTrials: number;
  targetPresentTrials: number; // Rondas con olor: VP + FN + FP en ronda con olor
  targetAbsentTrials: number; // Rondas en blanco: VN + FP en ronda en blanco
  sensitivity: number | null; // % VP / rondas con olor
  specificity: number | null; // % VN / rondas en blanco
  precision: number | null; // % VP / (VP + FP)
  accuracy: number; // % Exactitud global
  isReliableThreshold: boolean; // Sensibilidad >= 80% & especificidad >= 85%
  isSensoryLimit: boolean; // Sensibilidad entre 15% y 30% (cercano al azar 12.5%)
  isFrustrationWarning: boolean; // Especificidad < 70% (el perro adivina en controles)
}

export interface LevelMetricsSummary extends ThresholdMetrics {
  level: DilutionLevel;
  passedBlocksCount: number;
}

export interface SheetsConfig {
  webhookUrl: string;
  autoSync: boolean;
  lastSyncedAt?: string;
}
