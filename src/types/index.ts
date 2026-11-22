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
  controlPorts: number; // Total de brazos/puertos de control evaluados (7 por ronda con olor + 8 por blanco)
  vnPorts: number; // Rechazos correctos a nivel de puerto (controlPorts - fp)
  sensitivity: number | null; // % VP / rondas con olor
  specificity: number | null; // % VN_puertos / controlPorts (estándar por puerto en carrusel)
  precision: number | null; // % VPP = VP / (VP + FP)
  ppv: number | null; // Valor Predictivo Positivo (% VP / (VP + FP))
  npv: number | null; // Valor Predictivo Negativo (% VN_puertos / (VN_puertos + omisiones de diana))
  accuracy: number; // % Exactitud por ronda (VP + VN) / totalTrials
  balancedAccuracy: number | null; // % Exactitud balanceada = (Sensibilidad + Especificidad) / 2
  dPrime: number | null; // Índice d' de Teoría de Detección de Señales (corrección log-lineal de Hautus)
  isReliableThreshold: boolean; // Sensibilidad >= 80% & especificidad >= 85%
  isSensoryLimit: boolean; // Sensibilidad entre 15% y 30% (cercano al azar 12.5%)
  isFrustrationWarning: boolean; // Exceso de falsas alarmas en controles
}

export interface LevelMetricsSummary extends ThresholdMetrics {
  level: DilutionLevel;
  passedBlocksCount: number;
  isLevelMastered: boolean;
}

export interface SheetsConfig {
  webhookUrl: string;
  autoSync: boolean;
  lastSyncedAt?: string;
}
