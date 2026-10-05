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
export function computeThresholdMetrics(trials: Trial[]): ThresholdMetrics {
  let vp = 0;
  let fp = 0;
  let vn = 0;
  let fn = 0;

  for (const trial of trials) {
    const outcome = getTrialOutcome(trial);
    switch (outcome) {
      case 'VP':
        vp++;
        break;
      case 'FP':
        fp++;
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
  const targetPresentTrials = vp + fn;
  const targetAbsentTrials = vn + fp;

  const sensitivity = targetPresentTrials > 0
    ? Math.round((vp / targetPresentTrials) * 1000) / 10
    : null;

  const specificity = targetAbsentTrials > 0
    ? Math.round((vn / targetAbsentTrials) * 1000) / 10
    : null;

  const accuracy = totalTrials > 0
    ? Math.round(((vp + vn) / totalTrials) * 1000) / 10
    : 0;

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

  const isFrustrationWarning =
    specificity !== null &&
    targetAbsentTrials >= 3 &&
    specificity < 70;

  return {
    vp,
    fp,
    vn,
    fn,
    totalTrials,
    targetPresentTrials,
    targetAbsentTrials,
    sensitivity,
    specificity,
    accuracy,
    isReliableThreshold,
    isSensoryLimit,
    isFrustrationWarning,
  };
}

// Alias para compatibilidad
export const computeTDSMetrics = computeThresholdMetrics;

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
      return {
        ...metrics,
        level,
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
