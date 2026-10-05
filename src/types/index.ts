export interface DilutionLevel {
  id: string;
  name: string;
  theoreticalRatio: string;
  ratioValue: number;
  stepIndex: number;
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
  targetPresentTrials: number; // VP + FN
  targetAbsentTrials: number; // VN + FP (controles o blancos)
  sensitivity: number | null; // % Tasa de acierto
  specificity: number | null; // % Rechazo correcto
  accuracy: number; // % Exactitud global
  isReliableThreshold: boolean; // Sensibilidad >= 80% & especificidad >= 85%
  isSensoryLimit: boolean; // Sensibilidad entre 15% y 30% (cercano al azar 12.5%)
  isFrustrationWarning: boolean; // Especificidad < 70% (el perro adivina en controles)
}

export interface LevelMetricsSummary extends ThresholdMetrics {
  level: DilutionLevel;
}

export interface SheetsConfig {
  webhookUrl: string;
  autoSync: boolean;
  lastSyncedAt?: string;
}
