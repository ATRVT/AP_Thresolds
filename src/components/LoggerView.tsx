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
  ShieldCheck,
  ArrowRight,
  Cloud,
  Check,
  X,
  Minus,
  Sparkles,
  Shuffle,
  Lock,
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

  const activeDog = dogs.find((d) => d.id === sessionDefaults.dogId) || dogs[0];
  const activeLevel = levels.find((l) => l.id === sessionDefaults.dilutionId) || levels[0];

  // Comprobar si el perro superó el 80% en Stock
  const hasMasteredStock = useMemo(() => {
    return hasDogMasteredStock(trials, sessionDefaults.dogId);
  }, [trials, sessionDefaults.dogId]);

  // Si superó Stock o está en niveles superiores, se exigen al menos 2 rondas en vacío
  const requireBlanks = hasMasteredStock || sessionDefaults.dilutionId !== 'stock';

  // Progreso del bloque de 10 rondas
  const blockProgress = getBlockProgress(trials, sessionDefaults.dogId, sessionDefaults.dilutionId);
  const effectiveBlockNumber = forceNewBlockNumber || (blockProgress.isBlockComplete ? blockProgress.blockNumber + 1 : blockProgress.blockNumber);
  const currentRoundNumber = blockProgress.isBlockComplete && !forceNewBlockNumber ? 10 : blockProgress.roundInBlock;
  const isBlockFinished = blockProgress.isBlockComplete && !forceNewBlockNumber;

  // Plan pseudo-aleatorio balanceado para el bloque de 10 rondas
  const [blockPlan, setBlockPlan] = useState<PlannedRound[]>(() => generateBlockPlan(requireBlanks));

  // Regenerar plan cuando cambia el perro, nivel o bloque
  useEffect(() => {
    setBlockPlan(generateBlockPlan(requireBlanks));
  }, [sessionDefaults.dogId, sessionDefaults.dilutionId, effectiveBlockNumber, requireBlanks]);

  // Ronda planificada actual
  const plannedRound: PlannedRound | undefined = blockPlan[currentRoundNumber - 1];

  // Estado de la posición elegida para la ronda actual (inicializada por defecto con la sugerencia)
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

  // Manejador de las 3 respuestas: 'correct' | 'incorrect' | 'none'
  const handleRecordChoice = (choice: 'correct' | 'incorrect' | 'none') => {
    const effectiveReal = isBlank ? 0 : (realPosition || 1);
    let outcome: ResultOutcome;
    let marked: number | string;
    let descText: string;

    if (choice === 'correct') {
      outcome = 'VP';
      marked = effectiveReal;
      descText = `Positivo (VP) • Marcó soporte ${effectiveReal}`;
    } else if (choice === 'incorrect') {
      outcome = 'FP';
      marked = 'Incorrecto (control)';
      descText = 'Falso (FP) • Marcó control';
    } else {
      // choice === 'none'
      marked = 0;
      if (isBlank) {
        outcome = 'VN';
        descText = 'Omisión en vacío (VN) • Rechazo correcto';
      } else {
        outcome = 'FN';
        descText = 'Omisión (FN) • No alertó en diana';
      }
    }

    const roundToSave = blockProgress.isBlockComplete && !forceNewBlockNumber ? 1 : currentRoundNumber;

    const newTrial: Trial = {
      id: 'trial_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      dogId: sessionDefaults.dogId,
      handler: sessionDefaults.handler,
      judge: sessionDefaults.judge,
      sessionDate: sessionDefaults.sessionDate || getTodayDateString(),
      sessionTurn: sessionDefaults.sessionTurn || 'Mañana',
      dilutionId: sessionDefaults.dilutionId,
      blockNumber: effectiveBlockNumber,
      roundInBlock: roundToSave,
      isBlank,
      realPosition: effectiveReal,
      markedPosition: marked,
      resultOutcome: outcome,
    };

    // Vibración háptica en celulares
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (outcome === 'VP' || outcome === 'VN') {
        navigator.vibrate([40, 60, 40]);
      } else {
        navigator.vibrate([120]);
      }
    }

    onSaveTrial(newTrial);
    setLastSavedOutcome({ outcome, round: roundToSave, desc: descText });
    setForceNewBlockNumber(null);

    setTimeout(() => {
      setLastSavedOutcome(null);
    }, 2500);
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
    const first = newPlan[currentRoundNumber - 1] || newPlan[0];
    if (first) {
      setIsBlank(first.isBlank);
      setRealPosition(first.isBlank ? 0 : first.suggestedPosition);
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
    setForceNewBlockNumber(effectiveBlockNumber + 1);
  };

  const handleAdvanceToNextLevel = () => {
    const currentIndex = levels.findIndex((l) => l.id === activeLevel.id);
    if (currentIndex < levels.length - 1) {
      const nextLevel = levels[currentIndex + 1];
      onUpdateDefaults({ ...sessionDefaults, dilutionId: nextLevel.id });
      setForceNewBlockNumber(1);
    }
  };

  return (
    <div className="space-y-3 pb-24 max-w-xl mx-auto px-3.5">
      {/* Selector de perro y nivel de dilución */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs">
        <div className="flex items-center justify-between gap-2.5">
          {/* Perro */}
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Perro
            </label>
            <select
              value={sessionDefaults.dogId}
              onChange={(e) => handleDogChange(e.target.value)}
              aria-label="Seleccionar perro"
              className="w-full bg-[#F3F5F2] border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#FA963D]"
            >
              {dogs.map((dog) => (
                <option key={dog.id} value={dog.id}>
                  {dog.name} {dog.breed ? `(${dog.breed})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Nivel de dilución */}
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Nivel de dilución
            </label>
            <select
              value={sessionDefaults.dilutionId}
              onChange={(e) => handleLevelChange(e.target.value)}
              aria-label="Seleccionar nivel de dilución"
              className="w-full bg-[#F3F5F2] border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-[#c2410c] focus:outline-none focus:border-[#FA963D]"
            >
              {levels.map((lvl) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name} ({lvl.theoreticalRatio})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Barra colapsable de guía y juez */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <button
            type="button"
            onClick={() => setShowSessionConfig(!showSessionConfig)}
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
          >
            <User className="w-3.5 h-3.5 text-[#108BF7]" />
            <span>
              Guía: <b className="text-slate-900">{sessionDefaults.handler || 'No asignado'}</b>
            </span>
            <span className="text-slate-300">|</span>
            <ShieldCheck className="w-3.5 h-3.5 text-[#30E674]" />
            <span>
              Juez: <b className="text-slate-900">{sessionDefaults.judge || 'No asignado'}</b>
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSessionConfig ? 'rotate-180' : ''}`} />
          </button>

          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
            {sessionDefaults.sessionTurn}
          </span>
        </div>

        {/* Panel desplegable de ajustes de sesión */}
        {showSessionConfig && (
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500">Nombre del guía</label>
              <input
                type="text"
                value={sessionDefaults.handler}
                onChange={(e) => onUpdateDefaults({ ...sessionDefaults, handler: e.target.value })}
                className="w-full mt-1 bg-[#F3F5F2] border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900"
                placeholder="Ej. Carlos"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500">Preparador o juez ciego</label>
              <input
                type="text"
                value={sessionDefaults.judge}
                onChange={(e) => onUpdateDefaults({ ...sessionDefaults, judge: e.target.value })}
                className="w-full mt-1 bg-[#F3F5F2] border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900"
                placeholder="Ej. Laura"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500">Turno</label>
              <select
                value={sessionDefaults.sessionTurn}
                onChange={(e) => onUpdateDefaults({ ...sessionDefaults, sessionTurn: e.target.value as any })}
                aria-label="Seleccionar turno de sesión"
                className="w-full mt-1 bg-[#F3F5F2] border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900"
              >
                <option value="Mañana">Mañana</option>
                <option value="Tarde">Tarde</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500">Fecha de sesión</label>
              <input
                type="date"
                value={sessionDefaults.sessionDate}
                onChange={(e) => onUpdateDefaults({ ...sessionDefaults, sessionDate: e.target.value })}
                aria-label="Seleccionar fecha de sesión"
                className="w-full mt-1 bg-[#F3F5F2] border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tarjeta de seguimiento del bloque de 10 rondas */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FA963D]"></span>
            <span className="text-xs font-bold text-slate-900">
              {isBlockFinished
                ? `Bloque ${blockProgress.blockNumber} completado (10 de 10)`
                : `Bloque ${effectiveBlockNumber} • Ronda ${currentRoundNumber} de 10`}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            {activeLevel.name}
          </span>
        </div>

        {/* Línea visual de las 10 rondas */}
        <div className="grid grid-cols-10 gap-1 pt-0.5">
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
                className={`h-7 rounded-lg flex items-center justify-center text-[11px] font-bold transition-all border ${
                  isCurrent
                    ? 'border-[#FA963D] bg-[#FA963D]/10 text-[#c2410c] ring-2 ring-[#FA963D]/30'
                    : isCompleted
                    ? isHit
                      ? 'border-[#30E674] bg-[#30E674]/20 text-[#15803d]'
                      : 'border-[#FA963D] bg-[#FA963D]/20 text-[#c2410c]'
                    : 'border-slate-200 bg-[#F3F5F2] text-slate-400'
                }`}
              >
                {isCompleted ? (isHit ? '✓' : '✗') : roundNum}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-slate-600">
            Aciertos en el bloque: <b className="text-slate-900">{blockProgress.blockHits} / 10</b>{' '}
            <span className="text-[11px] text-slate-500">
              ({Math.round((blockProgress.blockHits / 10) * 100)}%)
            </span>
          </span>
          <span className="text-[11px] font-semibold text-[#15803d]">
            Meta: ≥ 8 aciertos (80%)
          </span>
        </div>

        {/* Notificación rápida de guardado automático */}
        {lastSavedOutcome && (
          <div className="p-2 rounded-xl bg-[#30E674]/15 border border-[#30E674]/40 text-[#15803d] text-xs text-center font-bold animate-in fade-in flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4 text-[#15803d]" />
            <span>Ronda {lastSavedOutcome.round} registrada: <b>{lastSavedOutcome.desc}</b></span>
          </div>
        )}

        {/* AL COMPLETAR LOS 10 ENSAYOS: RESUMEN Y GUARDADO DE SESIÓN */}
        {isBlockFinished && (
          <div className="mt-2.5 p-3.5 rounded-xl bg-[#F3F5F2] border-2 border-[#FA963D]/40 text-xs space-y-3 shadow-xs animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#FA963D]" />
                <span className="font-black text-slate-900 text-sm">
                  ¡Sesión de 10 ensayos completada!
                </span>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full font-black text-xs ${
                  blockProgress.blockHits >= 8
                    ? 'bg-[#30E674] text-slate-950 shadow-xs'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                {blockProgress.blockHits >= 8 ? 'Superado (≥ 80%)' : 'No superado (< 80%)'}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              {blockProgress.blockHits >= 8
                ? `¡Excelente trabajo! El perro consiguió ${blockProgress.blockHits} de 10 aciertos (${blockProgress.blockHits * 10}%). Ha superado el nivel ${activeLevel.name} y está listo para avanzar al siguiente nivel.`
                : `El perro obtuvo ${blockProgress.blockHits} de 10 aciertos (${blockProgress.blockHits * 10}%). Para poder pasar de nivel se requiere alcanzar un mínimo del 80% (8 de 10 aciertos). Se debe repetir otra sesión de 10 ensayos en ${activeLevel.name}.`}
            </p>

            {/* BOTÓN PROMINENTE PARA GUARDAR Y SINCRONIZAR CON GOOGLE SHEETS */}
            <div className="pt-1">
              <button
                type="button"
                disabled={isSyncing}
                onClick={onSyncPending}
                className="w-full py-3 px-4 rounded-xl bg-[#FA963D] hover:bg-[#e07a22] text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-[#FA963D]/25 active:scale-[0.98] transition-all"
              >
                <Cloud className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncing
                    ? 'Sincronizando sesión...'
                    : hasWebhook
                    ? 'Guardar y sincronizar sesión con Google Sheets'
                    : 'Guardar sesión (conectar con Google Sheets)'}
                </span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={handleStartNewBlock}
                className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs text-center transition-all ${
                  blockProgress.blockHits >= 8
                    ? 'bg-white border-slate-300 hover:bg-slate-50 text-slate-800'
                    : 'bg-[#FA963D] hover:bg-[#e07a22] text-slate-950 border-[#FA963D] shadow-xs'
                }`}
              >
                {blockProgress.blockHits >= 8
                  ? 'Repetir bloque en este nivel'
                  : 'Iniciar nueva sesión de 10 en este nivel'}
              </button>

              {blockProgress.blockHits >= 8 ? (
                <button
                  type="button"
                  onClick={handleAdvanceToNextLevel}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#30E674] hover:bg-[#28c764] font-bold text-slate-950 text-xs flex items-center justify-center gap-1 shadow-xs"
                >
                  <span>Avanzar al siguiente nivel</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="flex-1 py-2 px-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Siguiente nivel bloqueado (requiere ≥ 80%)</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ENTRADA RÁPIDA DE RONDAS SI NO HA TERMINADO EL BLOQUE */}
      {!isBlockFinished && (
        <>
          {/* PASO 1: Posición real con sugerencia automática balanceada */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#108BF7]/15 text-[#108BF7] text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <span className="text-xs font-bold text-slate-900">
                  Posición real (olor diana)
                </span>
              </div>

              {/* Toggle ronda en blanco */}
              <button
                type="button"
                onClick={handleToggleBlank}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                  isBlank
                    ? 'bg-[#FA963D]/15 border-[#FA963D] text-[#c2410c] shadow-xs ring-2 ring-[#FA963D]/30'
                    : 'bg-[#F3F5F2] border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {isBlank ? '⚪ Ronda en blanco activa' : '¿Ronda en blanco?'}
              </button>
            </div>

            {/* Banner de protocolo de aleatorización */}
            <div className="flex items-center justify-between mb-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <Shuffle className="w-3 h-3 text-[#108BF7]" />
                {requireBlanks
                  ? 'Plan balanceado: 2 vacíos + 8 soportes únicos sin repeticiones'
                  : 'Plan para Stock: 10 rondas equilibradas (≥ 80% activará vacíos)'}
              </span>
              <button
                type="button"
                onClick={handleRegeneratePlan}
                className="text-[10px] text-[#108BF7] hover:underline font-semibold"
                title="Rebarajar posiciones del bloque"
              >
                Rebarajar
              </button>
            </div>

            {isBlank ? (
              <div className="py-2.5 px-3 rounded-xl bg-[#FA963D]/10 border border-[#FA963D]/30 text-center">
                <p className="text-xs font-bold text-[#c2410c]">
                  Ronda en blanco sugerida (sin olor diana).
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  El perro debe revisar los 8 soportes sin alertar.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-[11px] text-slate-500 mb-2 flex items-center justify-between">
                  <span>Coloca el olor en el soporte indicado (o pulsa otro para cambiar):</span>
                  {realPosition && (
                    <span className="text-[10px] font-bold text-[#108BF7] bg-[#108BF7]/10 px-2 py-0.5 rounded-full">
                      Soporte {realPosition} seleccionado
                    </span>
                  )}
                </p>

                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
                    const isSelected = !isBlank && realPosition === num;
                    const isSuggested = !isBlank && plannedRound?.suggestedPosition === num;

                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleSelectRealPosition(num)}
                        className={`h-12 py-1.5 rounded-xl text-base font-bold transition-all duration-150 flex flex-col items-center justify-center border relative ${
                          isSelected
                            ? 'bg-[#108BF7] border-[#108BF7] text-white shadow-md shadow-[#108BF7]/25 scale-102 ring-2 ring-[#108BF7]/30'
                            : isSuggested
                            ? 'bg-[#108BF7]/10 border-[#108BF7]/60 text-[#0369a1] hover:bg-[#108BF7]/20'
                            : 'bg-[#F3F5F2] border-slate-200 text-slate-700 hover:bg-slate-200 active:scale-95'
                        }`}
                      >
                        <span>{num}</span>
                        <span className="text-[8px] uppercase font-normal tracking-wider opacity-80">
                          {isSelected ? 'Elegido' : isSuggested ? 'Sugerido' : 'Soporte'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* PASO 2: LAS 3 RESPUESTAS (Positivo, Falso, Omisión) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#30E674]/20 text-[#15803d] text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <span className="text-xs font-bold text-slate-900">
                  Respuesta del perro ({activeDog.name})
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                1 toque registra la ronda
              </span>
            </div>

            <div className="space-y-2">
              {/* Opción 1: Positivo (solo si hay diana) */}
              {!isBlank ? (
                <button
                  type="button"
                  onClick={() => handleRecordChoice('correct')}
                  className="w-full p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-[#30E674]/60 hover:bg-slate-50/50 active:scale-[0.98] transition-all flex items-center justify-between shadow-xs"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#30E674]/10 border border-[#30E674]/30 flex items-center justify-center text-[#16a34a] shrink-0">
                      <Check className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <span className="text-base font-bold text-slate-800">
                      Positivo
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 pr-1">
                    VP
                  </span>
                </button>
              ) : null}

              {/* Opción 2: Falso */}
              <button
                type="button"
                onClick={() => handleRecordChoice('incorrect')}
                className="w-full p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-[#FA963D]/60 hover:bg-slate-50/50 active:scale-[0.98] transition-all flex items-center justify-between shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-[#FA963D]/10 border border-[#FA963D]/30 flex items-center justify-center text-[#ea580c] shrink-0">
                    <X className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-base font-bold text-slate-800">
                    Falso
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-400 pr-1">
                  FP
                </span>
              </button>

              {/* Opción 3: Omisión */}
              <button
                type="button"
                onClick={() => handleRecordChoice('none')}
                className="w-full p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50 active:scale-[0.98] transition-all flex items-center justify-between shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <Minus className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-base font-bold text-slate-800">
                    {isBlank ? 'Omisión (vacío)' : 'Omisión'}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-400 pr-1">
                  {isBlank ? 'VN' : 'FN'}
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Barra inferior: Deshacer o reiniciar bloque */}
      <div className="flex items-center justify-between pt-1 text-xs">
        {trials.length > 0 ? (
          <button
            type="button"
            onClick={onUndoTrial}
            className="text-slate-500 hover:text-rose-600 flex items-center gap-1 transition-colors py-1 px-2 rounded-lg hover:bg-white"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Deshacer última pasada</span>
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={handleStartNewBlock}
          className="text-[#108BF7] hover:underline font-semibold py-1 px-2"
        >
          Comenzar nuevo bloque
        </button>
      </div>
    </div>
  );
};
