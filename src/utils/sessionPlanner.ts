import type { Trial } from '../types';

export interface PlannedRound {
  roundNumber: number; // 1 a 10
  isBlank: boolean;
  suggestedPosition: number; // 1 a 8, o 0 si es blanco
}

/**
 * Comprueba si el perro ha alcanzado al menos el 80% de aciertos en el bloque de Stock
 */
export function hasDogMasteredStock(trials: Trial[], dogId: string): boolean {
  const stockTrials = trials.filter(
    (t) => t.dogId === dogId && t.dilutionId === 'stock'
  );

  if (stockTrials.length < 10) return false;

  // Agrupamos por bloques de Stock
  const blockMap = new Map<number, Trial[]>();
  for (const t of stockTrials) {
    const bNum = t.blockNumber || 1;
    if (!blockMap.has(bNum)) blockMap.set(bNum, []);
    blockMap.get(bNum)!.push(t);
  }

  for (const [, bTrials] of blockMap) {
    if (bTrials.length >= 10) {
      const hits = bTrials.filter(
        (t) =>
          t.resultOutcome === 'VP' ||
          (t as any).resultTDS === 'VP' ||
          t.resultOutcome === 'VN' ||
          (t as any).resultTDS === 'VN'
      ).length;
      if (hits / bTrials.length >= 0.8) {
        return true;
      }
    }
  }

  // O si el acumulado global en Stock supera el 80% con al menos 10 ensayos
  const totalStockHits = stockTrials.filter(
    (t) =>
      t.resultOutcome === 'VP' ||
      (t as any).resultTDS === 'VP' ||
      t.resultOutcome === 'VN' ||
      (t as any).resultTDS === 'VN'
  ).length;

  return totalStockHits / stockTrials.length >= 0.8;
}

/**
 * Genera un plan pseudo-aleatorio balanceado para una sesión de 10 ensayos:
 * 1. Ninguna posición se repite dos veces consecutivas.
 * 2. Distribución equilibrada entre soportes bajos (1-4) y altos (5-8).
 * 3. Si ha superado Stock (o en niveles superiores): exactamente 2 rondas en vacío no consecutivas,
 *    y los 8 soportes (1 al 8) aparecen exactamente 1 vez cada uno en las 8 rondas restantes.
 */
export function generateBlockPlan(includeBlanks: boolean): PlannedRound[] {
  const rounds: PlannedRound[] = [];

  if (includeBlanks) {
    // 2 rondas en vacío no consecutivas en un bloque de 10
    // Elegimos dos índices entre 1 y 9 (dejamos la ronda 1 con diana para arrancar bien)
    // Aseguramos que no sean consecutivas
    const validPairs = [
      [2, 6], [2, 7], [2, 8], [3, 7], [3, 8], [3, 9],
      [4, 8], [4, 9], [5, 9], [3, 6], [4, 7]
    ];
    const chosenPair = validPairs[Math.floor(Math.random() * validPairs.length)];
    const blankIndices = new Set([chosenPair[0], chosenPair[1]]);

    // Barajamos exactamente los 8 soportes del 1 al 8 (aparecen exactamente 1 vez cada uno)
    const positions = [1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);

    let posIdx = 0;
    for (let r = 1; r <= 10; r++) {
      if (blankIndices.has(r)) {
        rounds.push({
          roundNumber: r,
          isBlank: true,
          suggestedPosition: 0,
        });
      } else {
        rounds.push({
          roundNumber: r,
          isBlank: false,
          suggestedPosition: positions[posIdx++],
        });
      }
    }
  } else {
    // Bloque sin rondas en blanco (Stock inicial):
    // 10 rondas con 5 soportes bajos (1-4) y 5 soportes altos (5-8), sin repeticiones consecutivas
    const low = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
    const high = [5, 6, 7, 8].sort(() => Math.random() - 0.5);

    // Añadimos 1 bajo y 1 alto extra para completar 10
    const extraLow = [1, 2, 3, 4][Math.floor(Math.random() * 4)];
    let extraHigh = [5, 6, 7, 8][Math.floor(Math.random() * 4)];

    const allLow = [...low, extraLow].sort(() => Math.random() - 0.5);
    const allHigh = [...high, extraHigh].sort(() => Math.random() - 0.5);

    const fullList: number[] = [];
    let lIdx = 0;
    let hIdx = 0;
    let last = 0;

    // Alternamos para que no se concentren solo en un lado
    for (let i = 0; i < 10; i++) {
      const takeLow = i % 2 === 0 ? (lIdx < allLow.length) : (hIdx >= allHigh.length);
      if (takeLow && lIdx < allLow.length) {
        let val = allLow[lIdx++];
        if (val === last && lIdx < allLow.length) {
          // Si coincide con la anterior, intercambiar
          const temp = val;
          val = allLow[lIdx];
          allLow[lIdx] = temp;
        }
        fullList.push(val);
        last = val;
      } else if (hIdx < allHigh.length) {
        let val = allHigh[hIdx++];
        if (val === last && hIdx < allHigh.length) {
          const temp = val;
          val = allHigh[hIdx];
          allHigh[hIdx] = temp;
        }
        fullList.push(val);
        last = val;
      }
    }

    // Doble verificación: si por azar hay dos números consecutivos iguales, intercambiar
    for (let i = 1; i < fullList.length; i++) {
      if (fullList[i] === fullList[i - 1]) {
        const swapWith = (i + 2 < fullList.length) ? i + 2 : i - 2;
        if (swapWith >= 0 && swapWith < fullList.length && fullList[swapWith] !== fullList[i]) {
          const temp = fullList[i];
          fullList[i] = fullList[swapWith];
          fullList[swapWith] = temp;
        }
      }
    }

    for (let r = 1; r <= 10; r++) {
      rounds.push({
        roundNumber: r,
        isBlank: false,
        suggestedPosition: fullList[r - 1],
      });
    }
  }

  return rounds;
}
