import React, { useState, useEffect, useMemo } from 'react';
import {
  Trial,
  Dog,
  DilutionLevel,
  ResultOutcome,
} from '../types';
import { SessionDefaults, getTodayDateString, getBlockProgress } from '../services/storage';
import {
  generateBlockPlan,
  hasDogMasteredStock,
  PlannedRound,
} from '../utils/sessionPlanner';
import {
  RotateCcw,
  ChevronDown,
  User,
  ArrowRight,
  Cloud,
  Check,
  X,
  Minus,
  Sparkles,
  Shuffle,
  Lock,
  Calendar,
  CircleOff,
} from 'lucide-react';

interface LoggerViewProps {
  dogs: Dog[];
  levels: DilutionLevel[];
  trials: Trial[];
  sessionDefaults: SessionDefaults;
  hasWebhook: boolean;
  isSyncing: boolean;
  onSaveTrial: (trial: Trial) => void;
  onUndoTrial: () => void;
  onUpdateDefaults: (defaults: SessionDefaults) => void;
  onSyncPending: () => void;
}

export const LoggerView: React.FC<LoggerViewProps> = ({
  dogs,
  levels,
  trials,
  sessionDefaults,
  hasWebhook,
  isSyncing,
  onSaveTrial,
  onUndoTrial,
  onUpdateDefaults,
  onSyncPending,
}) => {
  const [showSessionConfig, setShowSessionConfig] = useState<boolean>(false);
  const [lastSavedOutcome, setLastSavedOutcome] = useState<{ outcome: ResultOutcome; round: number; desc: string } | null>(null);
  const [forceNewBlockNumber, setForceNewBlockNumber] = useState<number | null>(null);

  const todayStr = getTodayDateString();
  const activeDate = sessionDefaults.sessionDate || todayStr;
  const isToday = activeDate === todayStr;

  const activeDog = dogs.find((d) => d.id === sessionDefaults.dogId) || dogs[0];
  const activeLevel = levels.find((l) => l.id === sessionDefaults.dilutionId) || levels[0];

  // Comprobar si el perro superó el 80% en Stock
  const hasMasteredStock = useMemo(() => {
    return hasDogMasteredStock(trials, sessionDefaults.dogId);
  }, [trials, sessionDefaults.dogId]);

  // Si superó Stock o está en niveles superiores, se exigen al menos 2 rondas en vacío
  const requireBlanks = hasMasteredStock || sessionDefaults.dilutionId !== 'stock';

  // Progreso del bloque de 10 rondas
  const blockProgress = getBlockProgress(
    trials,
    sessionDefaults.dogId,
    sessionDefaults.dilutionId,
    forceNewBlockNumber ?? undefined
  );
  const effectiveBlockNumber = blockProgress.blockNumber;
  const currentRoundNumber = blockProgress.roundInBlock;
  const isBlockFinished = blockProgress.isBlockComplete;

  // Plan pseudo-aleatorio balanceado para el bloque de 10 rondas
  const [blockPlan, setBlockPlan] = useState<PlannedRound[]>(() => generateBlockPlan(requireBlanks));

  // Regenerar plan cuando cambia el perro, nivel o bloque
  useEffect(() => {
    setBlockPlan(generateBlockPlan(requireBlanks));
  }, [sessionDefaults.dogId, sessionDefaults.dilutionId, effectiveBlockNumber, requireBlanks]);

  // Ronda planificada actual
  const plannedRound: PlannedRound | undefined = blockPlan[currentRoundNumber - 1];

  // Estado de la posición elegida para la ronda actual
  const [isBlank, setIsBlank] = useState<boolean>(plannedRound ? plannedRound.isBlank : false);
  const [realPosition, setRealPosition] = useState<number | null>(
    plannedRound ? (plannedRound.isBlank ? 0 : plannedRound.suggestedPosition) : 1
  );

  // Al avanzar de ronda, aplicar la sugerencia automática del plan balanceado
  useEffect(() => {
    if (plannedRound && !isBlockFinished) {
      setIsBlank(plannedRound.isBlank);
      setRealPosition(plannedRound.isBlank ? 0 : plannedRound.suggestedPosition);
    }
  }, [currentRoundNumber, plannedRound, isBlockFinished]);

  // Manejador de las 4 respuestas en línea: 'VP' | 'FP' | 'FN' | 'VN'
  const handleRecordOutcome = (selectedOutcome: ResultOutcome) => {
    let effectiveBlank = isBlank;
    let effectiveReal = isBlank ? 0 : (realPosition || 1);
    let outcome: ResultOutcome = selectedOutcome;
    let marked: number | string = 0;
    let descText = '';

    if (selectedOutcome === 'VP') {
      effectiveBlank = false;
      effectiveReal = realPosition && realPosition > 0 ? realPosition : (plannedRound?.suggestedPosition || 1);
      outcome = 'VP';
      marked = effectiveReal;
      descText = `Positivo (VP) • Soporte ${effectiveReal}`;
    } else if (selectedOutcome === 'FP') {
      outcome = 'FP';
      marked = 'Incorrecto (control)';
      descText = 'Falso (FP) • Marcó control';
    } else if (selectedOutcome === 'FN') {
      effectiveBlank = false;
      effectiveReal = realPosition && realPosition > 0 ? realPosition : (plannedRound?.suggestedPosition || 1);
      outcome = 'FN';
      marked = 0;
      descText = 'Omisión (FN) • No alertó';
    } else {
      // 'VN'
      effectiveBlank = true;
      effectiveReal = 0;
      outcome = 'VN';
      marked = 0;
      descText = 'Vacío (VN) • Rechazo correcto';
    }

    const roundToSave = currentRoundNumber;

    const newTrial: Trial = {
      id: 'trial_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      dogId: sessionDefaults.dogId,
      handler: sessionDefaults.handler,
      judge: sessionDefaults.judge,
      sessionDate: activeDate,
      sessionTurn: sessionDefaults.sessionTurn || 'Mañana',
      dilutionId: sessionDefaults.dilutionId,
      blockNumber: effectiveBlockNumber,
      roundInBlock: roundToSave,
      isBlank: effectiveBlank,
      realPosition: effectiveReal,
      markedPosition: marked,
      resultOutcome: outcome,
    };

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (outcome === 'VP' || outcome === 'VN') {
        navigator.vibrate([35, 50, 35]);
      } else {
        navigator.vibrate([100]);
      }
    }

    onSaveTrial(newTrial);
    setLastSavedOutcome({ outcome, round: roundToSave, desc: descText });
    setForceNewBlockNumber(null);

    setTimeout(() => {
      setLastSavedOutcome(null);
    }, 2000);
  };

  const handleSelectRealPosition = (pos: number) => {
    setRealPosition(pos);
    setIsBlank(false);
  };

  const handleToggleBlank = () => {
    const nextBlank = !isBlank;
    setIsBlank(nextBlank);
    setRealPosition(nextBlank ? 0 : (plannedRound?.suggestedPosition || 1));
  };

  const handleRegeneratePlan = () => {
    const newPlan = generateBlockPlan(requireBlanks);
    setBlockPlan(newPlan);
    const current = newPlan[currentRoundNumber - 1] || newPlan[0];
    if (current) {
      setIsBlank(current.isBlank);
      setRealPosition(current.isBlank ? 0 : current.suggestedPosition);
    }
  };

  const handleLevelChange = (lvlId: string) => {
    onUpdateDefaults({ ...sessionDefaults, dilutionId: lvlId });
    setForceNewBlockNumber(null);
  };

  const handleDogChange = (dogId: string) => {
    const dog = dogs.find((d) => d.id === dogId);
    onUpdateDefaults({
      ...sessionDefaults,
      dogId,
      handler: dog?.handlerDefault || sessionDefaults.handler,
    });
    setForceNewBlockNumber(null);
  };

  const handleStartNewBlock = () => {
    const maxExistingBlock = trials
      .filter((t) => t.dogId === sessionDefaults.dogId && t.dilutionId === sessionDefaults.dilutionId)
      .reduce((max, t) => Math.max(max, t.blockNumber || 1), 0);
    setForceNewBlockNumber(maxExistingBlock + 1);
  };

  const handleAdvanceToNextLevel = () => {
    const currentIndex = levels.findIndex((l) => l.id === activeLevel.id);
    if (currentIndex < levels.length - 1) {
      const nextLevel = levels[currentIndex + 1];
      const nextProgress = getBlockProgress(trials, sessionDefaults.dogId, nextLevel.id);
      onUpdateDefaults({ ...sessionDefaults, dilutionId: nextLevel.id });
      setForceNewBlockNumber(nextProgress.isBlockComplete ? nextProgress.blockNumber + 1 : null);
    }
  };

  return (
    <div className="space-y-2.5 pb-24 max-w-xl mx-auto px-3">
      {/* TARJETA 1: Selección rápida de perro, nivel y fecha */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs">
        <div className="grid grid-cols-2 gap-2">
          {/* Perro */}
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">
              Perro
            </label>
            <select
              value={sessionDefaults.dogId}
              onChange={(e) => handleDogChange(e.target.value)}
              aria-label="Seleccionar perro"
              className="w-full bg-[#F3F5F2] border border-slate-200/80 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#FA963D]"
            >
              {dogs.map((dog) => (
                <option key={dog.id} value={dog.id}>
                  {dog.name} {dog.breed ? `(${dog.breed})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Nivel de dilución */}
          <div>
            <label className="text-xs font-bold text-slate-500 flex items-center justify-between mb-1">
              <span>Nivel de dilución</span>
              {activeLevel.unitLabel && (
                <b className="font-black text-[#108BF7] bg-[#108BF7]/10 px-1.5 rounded">
                  {activeLevel.unitLabel}
                </b>
              )}
            </label>
            <select
              value={sessionDefaults.dilutionId}
              onChange={(e) => handleLevelChange(e.target.value)}
              aria-label="Seleccionar nivel de dilución"
              className="w-full bg-[#F3F5F2] border border-slate-200/80 rounded-xl px-3 py-2.5 text-sm font-bold text-[#c2410c] focus:outline-none focus:border-[#FA963D]"
            >
              {levels.map((lvl) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name} ({lvl.theoreticalRatio}{lvl.unitBoldOption ? ` • ${lvl.unitBoldOption}` : ''})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Fila compacta: Fecha editable directa + Guía/Juez desplegable */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-sm">
          {/* Selector directo de fecha */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#FA963D] shrink-0" />
            <input
              type="date"
              value={activeDate}
              onChange={(e) =>
                onUpdateDefaults({
                  ...sessionDefaults,
                  sessionDate: e.target.value || todayStr,
                })
              }
              aria-label="Fecha de la sesión"
              className="bg-[#F3F5F2] border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#FA963D]"
            />
            {!isToday && (
              <button
                type="button"
                onClick={() => onUpdateDefaults({ ...sessionDefaults, sessionDate: todayStr })}
                className="text-[10px] font-bold text-[#108BF7] hover:underline px-1"
              >
                Hoy
              </button>
            )}
          </div>

          {/* Botón guía y juez */}
          <button
            type="button"
            onClick={() => setShowSessionConfig(!showSessionConfig)}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-50"
          >
            <User className="w-3 h-3 text-[#108BF7]" />
            <span className="truncate max-w-[110px] font-medium text-slate-700">
              {sessionDefaults.handler || 'Guía'}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showSessionConfig ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Panel desplegable de guía, juez y turno */}
        {showSessionConfig && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-400">Guía</label>
              <input
                type="text"
                value={sessionDefaults.handler}
                onChange={(e) => onUpdateDefaults({ ...sessionDefaults, handler: e.target.value })}
                className="w-full mt-0.5 bg-[#F3F5F2] border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900"
                placeholder="Guía"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400">Juez ciego</label>
              <input
                type="text"
                value={sessionDefaults.judge}
                onChange={(e) => onUpdateDefaults({ ...sessionDefaults, judge: e.target.value })}
                className="w-full mt-0.5 bg-[#F3F5F2] border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900"
                placeholder="Juez"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400">Turno</label>
              <select
                value={sessionDefaults.sessionTurn}
                onChange={(e) => onUpdateDefaults({ ...sessionDefaults, sessionTurn: e.target.value as any })}
                aria-label="Seleccionar turno"
                className="w-full mt-0.5 bg-[#F3F5F2] border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900"
              >
                <option value="Mañana">Mañana</option>
                <option value="Tarde">Tarde</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* TARJETA 2: Panel unificado de bloque y registro en 1 pantalla */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3.5">
        {/* Cabecera de progreso del bloque */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FA963D] shrink-0"></span>
            <span className="text-sm font-extrabold text-slate-900 whitespace-nowrap">
              {isBlockFinished
                ? `Bloque ${blockProgress.blockNumber} listo`
                : `Bloque ${effectiveBlockNumber} • R${currentRoundNumber}/10`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                blockProgress.isLevelMastered
                  ? 'bg-[#30E674]/20 text-[#15803d]'
                  : blockProgress.passedBlocksCount === 1
                  ? 'bg-[#108BF7]/15 text-[#108BF7]'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              Consec. {Math.min(blockProgress.passedBlocksCount, 2)}/2
            </span>
            <span className="text-sm font-black text-slate-900 whitespace-nowrap">
              {blockProgress.blockHits}/10
            </span>
          </div>
        </div>

        {/* Tira visual de 10 rondas */}
        <div className="grid grid-cols-10 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((roundNum) => {
            const isCompleted = isBlockFinished ? true : roundNum < currentRoundNumber;
            const isCurrent = !isBlockFinished && roundNum === currentRoundNumber;
            const completedTrial = blockProgress.trialsInCurrentBlock[roundNum - 1];
            const isHit = completedTrial && (
              completedTrial.resultOutcome === 'VP' ||
              (completedTrial as any).resultTDS === 'VP' ||
              completedTrial.resultOutcome === 'VN' ||
              (completedTrial as any).resultTDS === 'VN'
            );

            return (
              <div
                key={roundNum}
                className={`h-8 rounded-lg flex items-center justify-center text-sm font-extrabold transition-all border ${
                  isCurrent
                    ? 'border-[#FA963D] bg-[#FA963D]/10 text-[#c2410c] ring-2 ring-[#FA963D]/25'
                    : isCompleted
                    ? isHit
                      ? 'border-[#30E674] bg-[#30E674]/20 text-[#15803d]'
                      : 'border-[#FA963D] bg-[#FA963D]/20 text-[#c2410c]'
                    : 'border-slate-200/80 bg-[#F3F5F2] text-slate-400'
                }`}
              >
                {isCompleted ? (isHit ? '✓' : '✗') : roundNum}
              </div>
            );
          })}
        </div>

        {/* Confirmación rápida al guardar */}
        {lastSavedOutcome && (
          <div className="py-1.5 px-2.5 rounded-xl bg-[#30E674]/15 border border-[#30E674]/40 text-[#15803d] text-[11px] text-center font-bold flex items-center justify-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#15803d]" />
            <span>Ronda {lastSavedOutcome.round}: {lastSavedOutcome.desc}</span>
          </div>
        )}

        {/* RESUMEN AL COMPLETAR LAS 10 RONDAS */}
        {isBlockFinished ? (() => {
          const vpCount = blockProgress.trialsInCurrentBlock.filter(
            (t) => t.resultOutcome === 'VP' || (t as any).resultTDS === 'VP'
          ).length;
          const vnCount = blockProgress.trialsInCurrentBlock.filter(
            (t) => t.resultOutcome === 'VN' || (t as any).resultTDS === 'VN'
          ).length;
          const pendingTotal = trials.filter((t) => !t.syncedToSheets).length;
          const isCurrentBlockSynced =
            blockProgress.trialsInCurrentBlock.length > 0 &&
            blockProgress.trialsInCurrentBlock.every((t) => t.syncedToSheets);

          return (
          <div className="p-3 rounded-xl bg-[#F3F5F2] border border-[#FA963D]/40 text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#FA963D]" />
                <span className="font-bold text-slate-900">
                  Sesión de 10 ensayos finalizada
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                  blockProgress.isLevelMastered
                    ? 'bg-[#30E674] text-slate-950'
                    : blockProgress.blockPassed
                    ? 'bg-[#108BF7]/15 text-[#108BF7] border border-[#108BF7]/30'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                {blockProgress.isLevelMastered
                  ? 'Nivel superado (2/2 consec. ≥ 80%)'
                  : blockProgress.blockPassed
                  ? '1 de 2 bloques consec. ≥ 80%'
                  : `Bloque no superado (${Math.min(blockProgress.passedBlocksCount, 2)}/2 consec.)`}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {blockProgress.isLevelMastered
                ? `Logró ${blockProgress.blockHits}/10 aciertos (${vpCount} positivas VP, ${vnCount} vacío VN${blockProgress.blockSensitivity !== null ? `, sensibilidad ${blockProgress.blockSensitivity}%` : ''}). Ya completó 2 bloques consecutivos válidos en ${activeLevel.name}.`
                : blockProgress.blockPassed
                ? `Primer bloque válido: ${blockProgress.blockHits}/10 aciertos (${vpCount} VP, ${vnCount} VN, sensibilidad ${blockProgress.blockSensitivity}%). Falta 1 bloque consecutivo más con ≥ 80% para superar ${activeLevel.name}.`
                : `Obtuvo ${blockProgress.blockHits}/10 aciertos (${vpCount} positivas VP, ${vnCount} vacío VN${blockProgress.blockSensitivity !== null ? `, sensibilidad ${blockProgress.blockSensitivity}%` : ''}). Necesita ≥ 80% de exactitud y ≥ 80% de sensibilidad en 2 bloques consecutivos (lleva ${Math.min(blockProgress.passedBlocksCount, 2)}/2).`}
            </p>

            {isCurrentBlockSynced && pendingTotal === 0 ? (
              <div className="w-full py-2.5 px-4 rounded-xl bg-[#30E674]/20 border border-[#30E674]/50 text-[#15803d] font-bold text-xs flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                <span>Sesión sincronizada en Google Sheets</span>
              </div>
            ) : (
              <button
                type="button"
                disabled={isSyncing}
                onClick={onSyncPending}
                className="w-full py-2.5 px-4 rounded-xl bg-[#FA963D] hover:bg-[#e07a22] text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all"
              >
                <Cloud className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncing
                    ? 'Sincronizando sesión...'
                    : hasWebhook
                    ? `Guardar y sincronizar con Google Sheets (${pendingTotal} pend.)`
                    : 'Guardar sesión (conectar con Google Sheets)'}
                </span>
              </button>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-slate-200/80">
              <button
                type="button"
                onClick={handleStartNewBlock}
                className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs text-center transition-all ${
                  blockProgress.isLevelMastered
                    ? 'bg-white border-slate-300 hover:bg-slate-50 text-slate-800'
                    : 'bg-[#FA963D] hover:bg-[#e07a22] text-slate-950 border-[#FA963D]'
                }`}
              >
                {blockProgress.isLevelMastered
                  ? 'Repetir bloque en este nivel'
                  : blockProgress.passedBlocksCount === 1
                  ? 'Iniciar 2.º bloque de 10 en este nivel'
                  : 'Nueva sesión de 10 en este nivel'}
              </button>

              {blockProgress.isLevelMastered ? (
                <button
                  type="button"
                  onClick={handleAdvanceToNextLevel}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#30E674] hover:bg-[#28c764] font-bold text-slate-950 text-xs flex items-center justify-center gap-1"
                >
                  <span>Avanzar al siguiente nivel</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="flex-1 py-2 px-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 font-semibold text-[11px] flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Siguiente nivel bloqueado ({blockProgress.passedBlocksCount}/2 bloques)</span>
                </div>
              )}
            </div>
          </div>
          );
        })() : (
          <>
            {/* PASO 1: Posición real amplia y legible */}
            <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-extrabold text-slate-900 whitespace-nowrap">
                    Posición del olor
                  </span>
                  {!isBlank && realPosition && (
                    <span className="text-xs font-extrabold text-[#108BF7] bg-[#108BF7]/10 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                      Soporte {realPosition}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleRegeneratePlan}
                    className="p-2 rounded-xl bg-[#F3F5F2] hover:bg-slate-200 text-slate-700 transition-colors"
                    title="Rebarajar orden aleatorio del bloque"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleBlank}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                      isBlank
                        ? 'bg-[#108BF7]/15 border-[#108BF7] text-[#0369a1]'
                        : 'bg-[#F3F5F2] border-slate-200 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {isBlank ? '⚪ Blanco' : '¿En blanco?'}
                  </button>
                </div>
              </div>

              {isBlank ? (
                <div className="py-3.5 px-3.5 rounded-xl bg-[#108BF7]/10 border border-[#108BF7]/25 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#0369a1]">
                      Ronda en blanco (sin olor diana)
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Si no marca ningún soporte, registra <b>Vacío (VN)</b>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleBlank}
                    className="text-xs font-bold text-[#0369a1] underline ml-2 shrink-0"
                  >
                    Poner olor
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
                    const isSelected = !isBlank && realPosition === num;
                    const isSuggested = !isBlank && plannedRound?.suggestedPosition === num;

                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleSelectRealPosition(num)}
                        className={`h-14 rounded-2xl text-xl font-black transition-all flex items-center justify-center border ${
                          isSelected
                            ? 'bg-[#108BF7] border-[#108BF7] text-white shadow-sm ring-2 ring-[#108BF7]/30'
                            : isSuggested
                            ? 'bg-[#108BF7]/10 border-[#108BF7]/50 text-[#0369a1]'
                            : 'bg-[#F3F5F2] border-slate-200/90 text-slate-800 hover:bg-slate-200'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PASO 2: Respuesta del perro - 4 botones grandes en línea horizontal */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-slate-900">
                  Respuesta de {activeDog.name}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  1 toque registra y avanza
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {/* 1. Positivo (VP) */}
                <button
                  type="button"
                  onClick={() => handleRecordOutcome('VP')}
                  className={`py-4 px-1 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-xs ${
                    isBlank
                      ? 'bg-white border-slate-200/60 opacity-40'
                      : 'bg-[#30E674]/12 border-[#30E674]/70 hover:bg-[#30E674]/20'
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-[#30E674]/25 border border-[#16a34a]/40 flex items-center justify-center text-[#15803d]">
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                  <div className="text-center">
                    <span className="text-[15px] font-black text-slate-900 block leading-tight">
                      Positivo
                    </span>
                    <span className="text-xs font-black text-[#15803d]">
                      VP
                    </span>
                  </div>
                </button>

                {/* 2. Falso (FP) */}
                <button
                  type="button"
                  onClick={() => handleRecordOutcome('FP')}
                  className="py-4 px-1 rounded-2xl border-2 border-[#FA963D]/75 bg-[#FA963D]/12 hover:bg-[#FA963D]/20 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-xs"
                >
                  <div className="w-11 h-11 rounded-full bg-[#FA963D]/25 border border-[#ea580c]/40 flex items-center justify-center text-[#c2410c]">
                    <X className="w-6 h-6 stroke-[3]" />
                  </div>
                  <div className="text-center">
                    <span className="text-[15px] font-black text-slate-900 block leading-tight">
                      Falso
                    </span>
                    <span className="text-xs font-black text-[#c2410c]">
                      FP
                    </span>
                  </div>
                </button>

                {/* 3. Omisión (FN) */}
                <button
                  type="button"
                  onClick={() => handleRecordOutcome('FN')}
                  className={`py-4 px-1 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-xs ${
                    isBlank
                      ? 'bg-white border-slate-200/60 opacity-40'
                      : 'bg-amber-500/12 border-amber-500/70 hover:bg-amber-500/20'
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-amber-500/20 border border-amber-600/40 flex items-center justify-center text-amber-800">
                    <Minus className="w-6 h-6 stroke-[3]" />
                  </div>
                  <div className="text-center">
                    <span className="text-[15px] font-black text-slate-900 block leading-tight">
                      Omisión
                    </span>
                    <span className="text-xs font-black text-amber-800">
                      FN
                    </span>
                  </div>
                </button>

                {/* 4. Vacío (VN) */}
                <button
                  type="button"
                  onClick={() => handleRecordOutcome('VN')}
                  className={`py-4 px-1 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-xs ${
                    isBlank
                      ? 'border-[#108BF7] ring-2 ring-[#108BF7]/30 bg-[#108BF7]/20'
                      : 'border-[#108BF7]/75 bg-[#108BF7]/12 hover:bg-[#108BF7]/20'
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-[#108BF7]/25 border border-[#108BF7]/50 flex items-center justify-center text-[#0369a1]">
                    <CircleOff className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="text-center">
                    <span className="text-[15px] font-black text-slate-900 block leading-tight">
                      Vacío
                    </span>
                    <span className="text-xs font-black text-[#0369a1]">
                      VN
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Acciones secundarias discretas */}
      <div className="flex items-center justify-between px-1 text-xs">
        {trials.length > 0 ? (
          <button
            type="button"
            onClick={onUndoTrial}
            className="text-slate-500 hover:text-rose-600 flex items-center gap-1.5 transition-colors py-1.5 font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Deshacer última ronda</span>
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={handleStartNewBlock}
          className="text-slate-500 hover:text-[#108BF7] font-semibold py-1.5"
        >
          Nuevo bloque
        </button>
      </div>
    </div>
  );
};
