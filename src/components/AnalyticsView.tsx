import React, { useState, useMemo } from 'react';
import { Trial, Dog, DilutionLevel } from '../types';
import { computeThresholdMetrics, computeMetricsByLevel } from '../utils/tdsMetrics';
import {
  AlertOctagon,
  TrendingDown,
  Sliders,
  CheckCircle,
} from 'lucide-react';

interface AnalyticsViewProps {
  trials: Trial[];
  dogs: Dog[];
  levels: DilutionLevel[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ trials, dogs, levels }) => {
  const [selectedDogId, setSelectedDogId] = useState<string>('all');

  const filteredTrials = useMemo(() => {
    if (selectedDogId === 'all') return trials;
    return trials.filter((t) => t.dogId === selectedDogId);
  }, [trials, selectedDogId]);

  const globalMetrics = useMemo(() => computeThresholdMetrics(filteredTrials), [filteredTrials]);
  const levelSummaries = useMemo(
    () => computeMetricsByLevel(filteredTrials, levels),
    [filteredTrials, levels]
  );

  const thresholdAnalysis = useMemo(() => {
    let reliableThresholdLevel: DilutionLevel | null = null;
    let sensoryLimitLevel: DilutionLevel | null = null;
    const frustratedLevels: DilutionLevel[] = [];

    for (const summary of levelSummaries) {
      if (summary.isFrustrationWarning) {
        frustratedLevels.push(summary.level);
      }

      if (summary.passedBlocksCount >= 2) {
        const specOk = summary.specificity === null || summary.specificity >= 85;
        if (specOk) {
          reliableThresholdLevel = summary.level;
        }
      }

      if (summary.sensitivity !== null && summary.sensitivity <= 30 && summary.totalTrials >= 4) {
        if (!sensoryLimitLevel) {
          sensoryLimitLevel = summary.level;
        }
      }
    }

    return {
      reliableThresholdLevel,
      sensoryLimitLevel,
      frustratedLevels,
    };
  }, [levelSummaries]);

  return (
    <div className="space-y-3 pb-24 max-w-xl mx-auto px-3">
      {/* Selector de perro */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#FA963D]" />
          <label className="text-xs font-bold text-slate-800">Perro:</label>
        </div>
        <select
          value={selectedDogId}
          onChange={(e) => setSelectedDogId(e.target.value)}
          aria-label="Filtrar por perro"
          className="bg-[#F3F5F2] border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#FA963D]"
        >
          <option value="all">Todos ({trials.length} rondas)</option>
          {dogs.map((dog) => {
            const count = trials.filter((t) => t.dogId === dog.id).length;
            return (
              <option key={dog.id} value={dog.id}>
                {dog.name} ({count} rondas)
              </option>
            );
          })}
        </select>
      </div>

      {/* Resumen de métricas + Conteo en línea */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs space-y-3">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-[#F3F5F2]/70">
            <span className="text-[10px] font-bold text-slate-500 block">
              Sensibilidad
            </span>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {globalMetrics.sensitivity !== null ? `${globalMetrics.sensitivity}%` : '--'}
            </div>
            <span className="text-[10px] font-semibold text-[#15803d]">
              Meta ≥ 80%
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F3F5F2]/70">
            <span className="text-[10px] font-bold text-slate-500 block">
              Especificidad
            </span>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {globalMetrics.specificity !== null ? `${globalMetrics.specificity}%` : '--'}
            </div>
            <span className="text-[10px] font-semibold text-[#108BF7]">
              Meta ≥ 85%
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F3F5F2]/70">
            <span className="text-[10px] font-bold text-slate-500 block">
              Precisión
            </span>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {globalMetrics.precision !== null ? `${globalMetrics.precision}%` : '--'}
            </div>
            <span className="text-[10px] font-semibold text-[#FA963D]">
              Marcas correctas
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F3F5F2]/70">
            <span className="text-[10px] font-bold text-slate-500 block">
              Exactitud
            </span>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {globalMetrics.accuracy}%
            </div>
            <span className="text-[10px] font-semibold text-slate-500">
              {filteredTrials.length} rondas
            </span>
          </div>
        </div>

        {/* 4 contadores en línea (VP, FP, FN, VN) */}
        <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-center">
          <div className="py-1.5 px-2 rounded-xl border border-slate-200/80 bg-white">
            <div className="text-sm font-black text-[#16a34a]">{globalMetrics.vp}</div>
            <div className="text-[10px] font-semibold text-slate-500">Positivo (VP)</div>
          </div>
          <div className="py-1.5 px-2 rounded-xl border border-slate-200/80 bg-white">
            <div className="text-sm font-black text-[#ea580c]">{globalMetrics.fp}</div>
            <div className="text-[10px] font-semibold text-slate-500">Falso (FP)</div>
          </div>
          <div className="py-1.5 px-2 rounded-xl border border-slate-200/80 bg-white">
            <div className="text-sm font-black text-slate-600">{globalMetrics.fn}</div>
            <div className="text-[10px] font-semibold text-slate-500">Omisión (FN)</div>
          </div>
          <div className="py-1.5 px-2 rounded-xl border border-slate-200/80 bg-white">
            <div className="text-sm font-black text-[#108BF7]">{globalMetrics.vn}</div>
            <div className="text-[10px] font-semibold text-slate-500">Vacío (VN)</div>
          </div>
        </div>
      </div>

      {/* Diagnóstico de umbrales compacto */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-[#16a34a] shrink-0" />
            <span>Umbral operativo</span>
          </div>
          {thresholdAnalysis.reliableThresholdLevel ? (
            <div>
              <div className="text-sm font-black text-[#15803d]">
                {thresholdAnalysis.reliableThresholdLevel.name}
              </div>
              <div className="text-[11px] text-slate-500">
                {thresholdAnalysis.reliableThresholdLevel.theoreticalRatio}
                {thresholdAnalysis.reliableThresholdLevel.unitLabel && (
                  <b className="font-black text-slate-900 ml-1">
                    ({thresholdAnalysis.reliableThresholdLevel.unitLabel})
                  </b>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">
              Pendiente (2 bloques ≥ 80%)
            </p>
          )}
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-[#FA963D] shrink-0" />
            <span>Límite sensorial</span>
          </div>
          {thresholdAnalysis.sensoryLimitLevel ? (
            <div>
              <div className="text-sm font-black text-[#c2410c]">
                {thresholdAnalysis.sensoryLimitLevel.name}
              </div>
              <div className="text-[11px] text-slate-500">
                {thresholdAnalysis.sensoryLimitLevel.theoreticalRatio}
                {thresholdAnalysis.sensoryLimitLevel.unitLabel && (
                  <b className="font-black text-slate-900 ml-1">
                    ({thresholdAnalysis.sensoryLimitLevel.unitLabel})
                  </b>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">
              Sin caída al azar (≤ 30%)
            </p>
          )}
        </div>
      </div>

      {thresholdAnalysis.frustratedLevels.length > 0 && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5">
          <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-rose-700 leading-relaxed">
            <b>Alerta de control:</b> En {thresholdAnalysis.frustratedLevels.map((l) => l.name).join(', ')} la especificidad es menor al 70% (exceso de falsas alarmas).
          </p>
        </div>
      )}

      {/* Rendimiento y curva unificados por nivel */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-900">
            Progreso por nivel de dilución
          </h3>
          <div className="flex items-center gap-2.5 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#30E674]"></span> ≥ 80%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#FA963D]"></span> ≤ 30%
            </span>
          </div>
        </div>

        {levelSummaries.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            Aún no hay rondas registradas.
          </div>
        ) : (
          <div className="space-y-2.5">
            {levelSummaries.map((summary) => {
              const sens = summary.sensitivity ?? summary.accuracy;
              const isOperative = summary.accuracy >= 80;
              const isSensoryLimit = sens <= 30;

              return (
                <div
                  key={summary.level.id}
                  className="p-2.5 rounded-xl bg-[#F3F5F2]/70 border border-slate-200/60 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{summary.level.name}</span>
                      <span className="text-[11px] text-slate-500 ml-1.5">
                        ({summary.level.theoreticalRatio}
                        {summary.level.unitLabel && (
                          <>
                            {' • '}
                            <b className="font-black text-slate-900">{summary.level.unitLabel}</b>
                          </>
                        )}
                        )
                      </span>
                    </div>
                    <span
                      className={`font-black text-xs ${
                        isOperative
                          ? 'text-[#15803d]'
                          : isSensoryLimit
                          ? 'text-[#c2410c]'
                          : 'text-[#108BF7]'
                      }`}
                    >
                      {summary.accuracy}% acierto
                    </span>
                  </div>

                  {/* Barra de progreso */}
                  <div className="relative w-full h-2.5 bg-white rounded-full overflow-hidden border border-slate-200/80">
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-[#FA963D]/60 z-10"
                      style={{ left: '12.5%' }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-[#15803d]/60 z-10"
                      style={{ left: '80%' }}
                    />
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOperative
                          ? 'bg-[#30E674]'
                          : isSensoryLimit
                          ? 'bg-[#FA963D]'
                          : 'bg-[#108BF7]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, summary.accuracy))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                    <div className="flex items-center gap-2.5 font-semibold">
                      <span className="text-[#16a34a]">VP: {summary.vp}</span>
                      <span className="text-[#ea580c]">FP: {summary.fp}</span>
                      <span className="text-slate-600">FN: {summary.fn}</span>
                      <span className="text-[#108BF7]">VN: {summary.vn}</span>
                    </div>
                    <span>
                      Bloques ≥ 80%: <b className="text-slate-800">{summary.passedBlocksCount}/2</b> • {summary.totalTrials} rondas
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
