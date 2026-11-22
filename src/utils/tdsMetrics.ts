import { ResultOutcome, ThresholdMetrics, Trial, DilutionLevel, LevelMetricsSummary } from '../types';

/**
 * Categoriza el resultado de una pasada según la matriz de resultados:
 * 
 * @param isBlank ¿Es ronda en blanco (solo controles)?
 * @param realPosition Número del soporte con olor (1-8), o 0 si es ronda en blanco
 * @param markedPosition Número que marcó el perro (1-8), o 0 si no marcó ninguno
 */
export function calculateResultOutcome(
  isBlank: boolean,
  realPosition: number,
  markedPosition: number
): ResultOutcome {
  // Si no marcó nada
  if (markedPosition === 0) {
    // Si era ronda en blanco y no marcó nada -> Rechazo correcto (VN)
    if (isBlank || realPosition === 0) {
      return 'VN';
    }
    // Si había olor pero no marcó nada -> Omisión / falso negativo (FN)
    return 'FN';
  }

  // Si marcó un soporte (1 al 8)
  if (!isBlank && realPosition > 0 && markedPosition === realPosition) {
    // Marcó exactamente el soporte con el olor diana -> Acierto / verdadero positivo (VP)
    return 'VP';
  }

  // Si marcó un soporte que NO era el olor diana (o si era ronda en blanco) -> Falsa alarma / falso positivo (FP)
  return 'FP';
}

// Alias para compatibilidad
export const calculateTDSOutcome = calculateResultOutcome;

/**
 * Obtiene el resultado de la pasada teniendo en cuenta compatibilidad hacia atrás
 */
export function getTrialOutcome(trial: Trial | any): ResultOutcome {
  return trial.resultOutcome || trial.resultTDS || 'VP';
}

/**
 * Calcula las métricas acumuladas a partir de una lista de pasadas.
 */
const pct = (num: number, den: number): number => Math.round((num / den) * 1000) / 10;

const ARMS_PER_CAROUSEL = 8;

/**
 * Función cuantil normal estándar inversa (aproximación racional de Acklam, precisión < 1.15e-9)
 * para el cálculo exacto del índice d' en Teoría de Detección de Señales (SDT).
 */
function normInv(p: number): number {
  const clamped = Math.min(1 - 1e-12, Math.max(1e-12, p));
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (clamped < pLow) {
    const q = Math.sqrt(-2 * Math.log(clamped));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (clamped <= pHigh) {
    const q = clamped - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - clamped));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

/**
 * Determina si una ronda era en blanco (sin olor diana).
 * VN siempre es ronda en blanco; VP y FN siempre son rondas con olor.
 * FP puede darse en ambos tipos de ronda, por eso se usa el campo isBlank.
 */
function isBlankRound(trial: Trial | any, outcome: ResultOutcome): boolean {
  if (outcome === 'VN') return true;
  if (outcome === 'VP' || outcome === 'FN') return false;
  return trial.isBlank === true || trial.realPosition === 0;
}

export function computeThresholdMetrics(trials: Trial[]): ThresholdMetrics {
  let vp = 0;
  let fp = 0;
  let vn = 0;
  let fn = 0;
  let fpTarget = 0; // marcó un control en ronda con olor (también es un fallo de detección)
  let fpBlank = 0; // marcó algo en ronda en blanco

  for (const trial of trials) {
    const outcome = getTrialOutcome(trial);
    switch (outcome) {
      case 'VP':
        vp++;
        break;
      case 'FP':
        fp++;
        if (isBlankRound(trial, outcome)) fpBlank++;
        else fpTarget++;
        break;
      case 'VN':
        vn++;
        break;
      case 'FN':
        fn++;
        break;
    }
  }

  const totalTrials = trials.length;
  // Rondas con olor: VP + FN + falsos en ronda con olor
  const targetPresentTrials = vp + fn + fpTarget;
  // Rondas en blanco (sin olor diana): VN + falsos en ronda en blanco
  const targetAbsentTrials = vn + fpBlank;

  // Estándar de oro por puerto/brazo en carrusel de 8 brazos:
  // 7 brazos control en cada ronda con olor + 8 brazos control en cada ronda en blanco
  const controlPorts =
    (ARMS_PER_CAROUSEL - 1) * targetPresentTrials + ARMS_PER_CAROUSEL * targetAbsentTrials;
  const vnPorts = Math.max(0, controlPorts - fp);
  const missedTargets = targetPresentTrials - vp; // FN + fpTarget

  // Sensibilidad = VP / todas las rondas (puertos diana) con olor
  const sensitivity = targetPresentTrials > 0 ? pct(vp, targetPresentTrials) : null;

  // Especificidad por puerto = VN_puertos / controlPorts
  const specificity = controlPorts > 0 ? pct(vnPorts, controlPorts) : null;

  // Valor Predictivo Positivo (VPP / Precisión) = VP / (VP + FP)
  const ppv = vp + fp > 0 ? pct(vp, vp + fp) : null;
  const precision = ppv;

  // Valor Predictivo Negativo (VPN) = VN_puertos / (VN_puertos + omisiones de diana)
  const npv = vnPorts + missedTargets > 0 ? pct(vnPorts, vnPorts + missedTargets) : null;

  // Exactitud por ronda = (VP + VN) / total de rondas
  const accuracy = totalTrials > 0 ? pct(vp + vn, totalTrials) : 0;

  // Exactitud balanceada = (Sensibilidad + Especificidad) / 2 (inmune al desbalanceo 7:1)
  const balancedAccuracy =
    sensitivity !== null && specificity !== null
      ? Math.round(((sensitivity + specificity) / 2) * 10) / 10
      : null;

  // Índice d' (d-prime) de Teoría de Detección de Señales con corrección log-lineal de Hautus (1995)
  const dPrime =
    targetPresentTrials > 0 && controlPorts > 0
      ? Math.round(
          (normInv((vp + 0.5) / (targetPresentTrials + 1)) -
            normInv((fp + 0.5) / (controlPorts + 1))) *
            100
        ) / 100
      : null;

  // Criterios de determinación de umbrales
  const isReliableThreshold =
    sensitivity !== null &&
    specificity !== null &&
    sensitivity >= 80 &&
    specificity >= 85;

  const isSensoryLimit =
    sensitivity !== null &&
    sensitivity >= 15 &&
    sensitivity <= 30;

  const blankSpecificity = targetAbsentTrials > 0 ? pct(vn, targetAbsentTrials) : null;
  const isFrustrationWarning =
    (blankSpecificity !== null && targetAbsentTrials >= 3 && blankSpecificity < 70) ||
    (totalTrials >= 10 && specificity !== null && specificity < 95);

  return {
    vp,
    fp,
    vn,
    fn,
    totalTrials,
    targetPresentTrials,
    targetAbsentTrials,
    controlPorts,
    vnPorts,
    sensitivity,
    specificity,
    precision,
    ppv,
    npv,
    accuracy,
    balancedAccuracy,
    dPrime,
    isReliableThreshold,
    isSensoryLimit,
    isFrustrationWarning,
  };
}

// Alias para compatibilidad
export const computeTDSMetrics = computeThresholdMetrics;

/**
 * Evalúa si un bloque de 10 rondas cumple el criterio de superación (≥ 80%).
 * Exige: bloque completo de 10 rondas, Exactitud (VP+VN) ≥ 80%,
 * Sensibilidad en diana ≥ 80% (evita aprobar con 6/8 VP = 75% + 2 VN)
 * y Especificidad ≥ 50% cuando haya falsos o blancos.
 */
export function evaluateBlockStatus(blockTrials: Trial[]) {
  const sample = blockTrials.slice(0, 10);
  const metrics = computeThresholdMetrics(sample);
  const hits = metrics.vp + metrics.vn;
  const isComplete = blockTrials.length >= 10;

  const passed =
    isComplete &&
    metrics.accuracy >= 80 &&
    metrics.sensitivity !== null &&
    metrics.sensitivity >= 80 &&
    (metrics.specificity === null || metrics.specificity >= 50);

  return {
    isComplete,
    hits,
    metrics,
    passed,
  };
}

/**
 * Evalúa la racha de bloques consecutivos superados (≥ 80%) para un perro y nivel.
 * Solo un bloque completo fallido rompe la racha consecutiva.
 */
export function evaluateConsecutiveBlocks(trials: Trial[]) {
  const blockMap = new Map<number, Trial[]>();
  for (const t of trials) {
    const bNum = t.blockNumber || 1;
    if (!blockMap.has(bNum)) blockMap.set(bNum, []);
    blockMap.get(bNum)!.push(t);
  }

  const sortedBlockNumbers = Array.from(blockMap.keys()).sort((a, b) => a - b);

  let currentStreak = 0;
  let maxStreak = 0;
  let totalPassedBlocks = 0;

  for (const bNum of sortedBlockNumbers) {
    const bTrials = [...blockMap.get(bNum)!].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const status = evaluateBlockStatus(bTrials);
    if (status.passed) {
      totalPassedBlocks++;
      currentStreak++;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    } else if (status.isComplete) {
      currentStreak = 0;
    }
  }

  return {
    maxConsecutivePassed: maxStreak,
    currentConsecutivePassed: currentStreak,
    totalPassedBlocks,
    isLevelMastered: maxStreak >= 2,
  };
}

/**
 * Agrupa las pasadas por nivel de dilución y calcula sus métricas individuales.
 */
export function computeMetricsByLevel(
  trials: Trial[],
  levels: DilutionLevel[]
): LevelMetricsSummary[] {
  return levels
    .map((level) => {
      const levelTrials = trials.filter((t) => t.dilutionId === level.id);
      const metrics = computeThresholdMetrics(levelTrials);

      // Agrupar por perro para evaluar rachas consecutivas sin mezclar perros
      const trialsByDog = new Map<string, Trial[]>();
      for (const t of levelTrials) {
        if (!trialsByDog.has(t.dogId)) trialsByDog.set(t.dogId, []);
        trialsByDog.get(t.dogId)!.push(t);
      }

      let bestProgress = 0;
      let isLevelMastered = false;

      for (const dogTrials of trialsByDog.values()) {
        const streak = evaluateConsecutiveBlocks(dogTrials);
        if (streak.isLevelMastered) {
          isLevelMastered = true;
          bestProgress = Math.max(bestProgress, streak.maxConsecutivePassed);
        } else {
          bestProgress = Math.max(bestProgress, streak.currentConsecutivePassed);
        }
      }

      return {
        ...metrics,
        level,
        passedBlocksCount: bestProgress,
        isLevelMastered,
      };
    })
    .filter((summary) => summary.totalTrials > 0);
}

/**
 * Obtiene la etiqueta y descripción en minúsculas (sentence case) con colores del logo
 */
export function getOutcomeInfo(outcome: ResultOutcome) {
  switch (outcome) {
    case 'VP':
      return {
        code: 'VP',
        name: 'Verdadero positivo',
        english: 'Hit',
        color: 'bg-[#30E674] text-slate-900',
        border: 'border-[#30E674]',
        badge: 'bg-[#30E674]/20 text-[#16a34a] border-[#30E674]/40',
        desc: 'Alerta correcta en la posición del olor diana.',
      };
    case 'FP':
      return {
        code: 'FP',
        name: 'Falso positivo',
        english: 'False alarm',
        color: 'bg-[#FA963D] text-slate-950',
        border: 'border-[#FA963D]',
        badge: 'bg-[#FA963D]/20 text-[#ea580c] border-[#FA963D]/40',
        desc: 'Alerta errónea en un soporte de control.',
      };
    case 'VN':
      return {
        code: 'VN',
        name: 'Verdadero negativo',
        english: 'Correct rejection',
        color: 'bg-[#108BF7] text-white',
        border: 'border-[#108BF7]',
        badge: 'bg-[#108BF7]/20 text-[#0284c7] border-[#108BF7]/40',
        desc: 'Rechazo correcto en ronda en blanco (pasó de largo).',
      };
    case 'FN':
      return {
        code: 'FN',
        name: 'Falso negativo',
        english: 'Miss',
        color: 'bg-amber-500 text-slate-950',
        border: 'border-amber-500',
        badge: 'bg-amber-500/20 text-amber-700 border-amber-500/40',
        desc: 'Pasó de largo frente al olor diana sin alertar.',
      };
  }
}

// Alias para compatibilidad
export const getTDSOutcomeInfo = getOutcomeInfo;
