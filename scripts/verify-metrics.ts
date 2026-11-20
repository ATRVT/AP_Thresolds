import assert from 'node:assert';
import { computeThresholdMetrics, computeMetricsByLevel } from '../src/utils/tdsMetrics';
import { getBlockProgress } from '../src/services/storage';
import { hasDogMasteredStock } from '../src/utils/sessionPlanner';
import { OFFICIAL_DILUTION_TABLE } from '../src/constants/dilutions';

let ts = 0;
const t = (outcome: string, isBlank: boolean, block = 1, dilutionId = 'lvl-1', dogId = 'd1'): any => ({
  id: 'x' + ts,
  timestamp: new Date(1_700_000_000_000 + ts++ * 1000).toISOString(),
  dogId,
  dilutionId,
  blockNumber: block,
  isBlank,
  realPosition: isBlank ? 0 : 3,
  resultOutcome: outcome,
});
const rep = (n: number, f: () => any) => Array.from({ length: n }, f);

// Caso 1: bloque típico con 2 blancos
// 8 rondas con olor: 6 VP, 1 FN, 1 FP (marcó control) | 2 blancos: 1 VN, 1 FP
const c1 = [
  ...rep(6, () => t('VP', false)),
  t('FN', false),
  t('FP', false),
  t('VN', true),
  t('FP', true),
];
const m1 = computeThresholdMetrics(c1);
assert.strictEqual(m1.targetPresentTrials, 8);
assert.strictEqual(m1.targetAbsentTrials, 2);
assert.strictEqual(m1.sensitivity, 75); // 6/8
assert.strictEqual(m1.specificity, 33.3); // VN / (VN + FP) = 1/3
assert.strictEqual(m1.precision, 75); // 6/(6+2)
assert.strictEqual(m1.accuracy, 70); // (6+1)/10
console.log('✓ Caso 1 (bloque mixto):', m1.sensitivity, m1.specificity, m1.precision, m1.accuracy);

// Caso 2: el error antiguo. 5 VP + 5 FP en rondas con olor -> antes daba 100% de sensibilidad
const m2 = computeThresholdMetrics([...rep(5, () => t('VP', false)), ...rep(5, () => t('FP', false))]);
assert.strictEqual(m2.sensitivity, 50);
assert.strictEqual(m2.specificity, 0); // 0 VN / (0 VN + 5 FP)
assert.strictEqual(m2.precision, 50);
assert.strictEqual(m2.accuracy, 50);
console.log('✓ Caso 2 (falsos en rondas con olor cuentan como fallo de detección y especificidad)');

// Caso 3: solo Stock sin blancos, 9 VP + 1 FN
const m3 = computeThresholdMetrics([...rep(9, () => t('VP', false)), t('FN', false)]);
assert.strictEqual(m3.sensitivity, 90);
assert.strictEqual(m3.specificity, null);
assert.strictEqual(m3.precision, 100);
assert.strictEqual(m3.accuracy, 90);
console.log('✓ Caso 3 (Stock sin blancos)');

// Caso 4: criterio de nivel = 2 bloques de 10 con >= 80%
ts = 0;
const b1 = [...rep(8, () => t('VP', false, 1)), ...rep(2, () => t('FN', false, 1))]; // 8/10 ✓
const b2 = [...rep(7, () => t('VP', false, 2)), ...rep(3, () => t('FN', false, 2))]; // 7/10 ✗
const b3 = [...rep(7, () => t('VP', false, 3)), ...rep(2, () => t('VN', true, 3)), t('FP', true, 3)]; // 9/10 ✓
let p = getBlockProgress(b1, 'd1', 'lvl-1');
assert.strictEqual(p.passedBlocksCount, 1);
assert.strictEqual(p.isLevelMastered, false);
p = getBlockProgress([...b1, ...b2], 'd1', 'lvl-1');
assert.strictEqual(p.passedBlocksCount, 1);
assert.strictEqual(p.isLevelMastered, false);
assert.strictEqual(p.blockHits, 7);
p = getBlockProgress([...b1, ...b2, ...b3], 'd1', 'lvl-1');
assert.strictEqual(p.passedBlocksCount, 2);
assert.strictEqual(p.isLevelMastered, true);
assert.strictEqual(p.blockHits, 9);
const lvl = computeMetricsByLevel([...b1, ...b2, ...b3], OFFICIAL_DILUTION_TABLE);
assert.strictEqual(lvl[0].passedBlocksCount, 2);
console.log('✓ Caso 4 (nivel superado solo con 2 bloques ≥ 80%)');

// Caso 5: otro perro no cuenta ni en getBlockProgress ni en computeMetricsByLevel
const crossDogTrials = [...b1, ...b3.map((x) => ({ ...x, dogId: 'd2' }))];
p = getBlockProgress(crossDogTrials, 'd1', 'lvl-1');
assert.strictEqual(p.passedBlocksCount, 1);
const lvlCross = computeMetricsByLevel(crossDogTrials, OFFICIAL_DILUTION_TABLE);
assert.strictEqual(lvlCross[0].passedBlocksCount, 1);
console.log('✓ Caso 5 (los bloques de otro perro no se mezclan)');

// Caso 6: activación de blancos en Stock (1 bloque ≥ 80%), sin el atajo del acumulado
ts = 0;
const s1 = [...rep(7, () => t('VP', false, 1, 'stock')), ...rep(3, () => t('FN', false, 1, 'stock'))];
const s2 = rep(5, () => t('VP', false, 2, 'stock'));
assert.strictEqual(hasDogMasteredStock([...s1, ...s2] as any, 'd1'), false);
const s3 = [...rep(8, () => t('VP', false, 3, 'stock')), ...rep(2, () => t('FN', false, 3, 'stock'))];
assert.strictEqual(hasDogMasteredStock([...s1, ...s3] as any, 'd1'), true);
console.log('✓ Caso 6 (rondas en blanco tras un bloque de Stock ≥ 80%)');

console.log('\nTodas las fórmulas verificadas.');
