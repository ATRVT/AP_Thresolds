import assert from 'node:assert';

// Replicación de la función pura de categorización TDS
function calculateTDSOutcome(isBlank, realPosition, markedPosition) {
  if (markedPosition === 0) {
    if (isBlank || realPosition === 0) {
      return 'VN';
    }
    return 'FN';
  }

  if (!isBlank && realPosition > 0 && markedPosition === realPosition) {
    return 'VP';
  }

  return 'FP';
}

function computeTDSMetrics(trials) {
  let vp = 0;
  let fp = 0;
  let vn = 0;
  let fn = 0;

  for (const trial of trials) {
    switch (trial.resultTDS) {
      case 'VP': vp++; break;
      case 'FP': fp++; break;
      case 'VN': vn++; break;
      case 'FN': fn++; break;
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
    vp, fp, vn, fn,
    totalTrials,
    sensitivity,
    specificity,
    accuracy,
    isReliableThreshold,
    isSensoryLimit,
    isFrustrationWarning,
  };
}

console.log('--- 1. Probando clasificación TDS (Astrid Concha 2019) ---');

// Caso 1: Olor diana en bote 3, perro marca bote 3 -> VP (Hit)
assert.strictEqual(calculateTDSOutcome(false, 3, 3), 'VP');

// Caso 2: Olor diana en bote 3, perro marca bote 5 -> FP (Falsa Alarma en control)
assert.strictEqual(calculateTDSOutcome(false, 3, 5), 'FP');

// Caso 3: Olor diana en bote 3, perro no marca nada (0) -> FN (Miss / Omisión)
assert.strictEqual(calculateTDSOutcome(false, 3, 0), 'FN');

// Caso 4: Ronda en blanco (0), perro no marca nada (0) -> VN (Rechazo Correcto)
assert.strictEqual(calculateTDSOutcome(true, 0, 0), 'VN');

// Caso 5: Ronda en blanco (0), perro marca bote 4 -> FP (Falsa Alarma en blanco)
assert.strictEqual(calculateTDSOutcome(true, 0, 4), 'FP');

console.log('✓ Clasificación de los 4 cuadrantes TDS validada.');

console.log('--- 2. Probando cálculo de métricas TDS y umbrales ---');

const mockTrials = [
  // 8 aciertos diana (VP)
  { resultTDS: 'VP' }, { resultTDS: 'VP' }, { resultTDS: 'VP' }, { resultTDS: 'VP' },
  { resultTDS: 'VP' }, { resultTDS: 'VP' }, { resultTDS: 'VP' }, { resultTDS: 'VP' },
  // 2 omisiones diana (FN)
  { resultTDS: 'FN' }, { resultTDS: 'FN' },
  // 9 rechazos correctos en blancos (VN)
  { resultTDS: 'VN' }, { resultTDS: 'VN' }, { resultTDS: 'VN' }, { resultTDS: 'VN' },
  { resultTDS: 'VN' }, { resultTDS: 'VN' }, { resultTDS: 'VN' }, { resultTDS: 'VN' }, { resultTDS: 'VN' },
  // 1 falsa alarma en blanco (FP)
  { resultTDS: 'FP' },
];

const metrics = computeTDSMetrics(mockTrials);

// Sensibilidad: VP / (VP + FN) = 8 / (8 + 2) = 80.0%
assert.strictEqual(metrics.sensitivity, 80);

// Especificidad: VN / (VN + FP) = 9 / (9 + 1) = 90.0%
assert.strictEqual(metrics.specificity, 90);

// Exactitud: (VP + VN) / 20 = 17 / 20 = 85.0%
assert.strictEqual(metrics.accuracy, 85);

// Umbral Confiable: Sens >= 80% y Espec >= 85% -> true
assert.strictEqual(metrics.isReliableThreshold, true);

// Límite Sensorial: Sens <= 30% -> false
assert.strictEqual(metrics.isSensoryLimit, false);

// Alerta de Frustración: Espec < 70% -> false
assert.strictEqual(metrics.isFrustrationWarning, false);

console.log('✓ Métricas científicas calculadas con precisión:');
console.log(`  - Sensibilidad: ${metrics.sensitivity}% (Meta ≥ 80%)`);
console.log(`  - Especificidad: ${metrics.specificity}% (Meta ≥ 85%)`);
console.log(`  - Exactitud Global: ${metrics.accuracy}%`);
console.log(`  - Umbral Confiable Alcanzado: ${metrics.isReliableThreshold}`);

console.log('\n>>> TODAS LAS PRUEBAS DE LÓGICA TDS HAN PASADO EXITOSAMENTE <<<');
