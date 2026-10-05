import React, { useState, useMemo } from 'react';
import { Trial, Dog, DilutionLevel } from '../types';
import { computeThresholdMetrics, computeMetricsByLevel } from '../utils/tdsMetrics';
import {
  Award,
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

  // Filtrado de pasadas por perro
  const filteredTrials = useMemo(() => {
    if (selectedDogId === 'all') return trials;
    return trials.filter((t) => t.dogId === selectedDogId);
  }, [trials, selectedDogId]);

  // Métricas acumuladas y por nivel
  const globalMetrics = useMemo(() => computeThresholdMetrics(filteredTrials), [filteredTrials]);
  const levelSummaries = useMemo(
    () => computeMetricsByLevel(filteredTrials, levels),
    [filteredTrials, levels]
  );

  // Detección automática de umbrales
  const thresholdAnalysis = useMemo(() => {
    let reliableThresholdLevel: DilutionLevel | null = null;
    let sensoryLimitLevel: DilutionLevel | null = null;
    const frustratedLevels: DilutionLevel[] = [];

    for (const summary of levelSummaries) {
      if (summary.isFrustrationWarning) {
        frustratedLevels.push(summary.level);
      }

      if (summary.sensitivity !== null && summary.specificity !== null) {
        if (summary.sensitivity >= 80 && summary.specificity >= 85) {
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
    <div className="space-y-3.5 pb-24 max-w-xl mx-auto px-3.5">
      {/* Selector de perro */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#FA963D]" />
          <label className="text-xs font-bold text-slate-800">Filtrar por perro:</label>
        </div>
        <select
          value={selectedDogId}
          onChange={(e) => setSelectedDogId(e.target.value)}
          aria-label="Filtrar por perro"
          className="bg-[#F3F5F2] border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#FA963D]"
        >
          <option value="all">Todos los perros ({trials.length} pasadas)</option>
          {dogs.map((dog) => {
            const count = trials.filter((t) => t.dogId === dog.id).length;
            return (
              <option key={dog.id} value={dog.id}>
                {dog.name} ({count} pasadas)
              </option>
            );
          })}
        </select>
      </div>

      {/* Tarjetas de métricas principales */}
      <div className="grid grid-cols-3 gap-2">
        {/* Sensibilidad */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Sensibilidad
          </span>
          <div className="text-2xl font-black text-slate-900">
            {globalMetrics.sensitivity !== null ? `${globalMetrics.sensitivity}%` : '--'}
          </div>
          <span className="text-[10px] font-bold text-[#15803d] block mt-0.5">
            Meta: ≥ 80%
          </span>
          <div className="text-[9px] text-slate-400 mt-1">
            Aciertos en diana
          </div>
        </div>

        {/* Especificidad */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Especificidad
          </span>
          <div className="text-2xl font-black text-slate-900">
            {globalMetrics.specificity !== null ? `${globalMetrics.specificity}%` : '--'}
          </div>
          <span className="text-[10px] font-bold text-[#108BF7] block mt-0.5">
            Meta: ≥ 85%
          </span>
          <div className="text-[9px] text-slate-400 mt-1">
            Rechazo de controles
          </div>
        </div>

        {/* Exactitud global */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Exactitud
          </span>
          <div className="text-2xl font-black text-slate-900">
            {globalMetrics.accuracy}%
          </div>
          <span className="text-[10px] font-bold text-[#c2410c] block mt-0.5">
            Global
          </span>
          <div className="text-[9px] text-slate-400 mt-1">
            Total aciertos
          </div>
        </div>
      </div>

      {/* Determinación de umbrales */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <Award className="w-4 h-4 text-[#FA963D]" />
          <span>Determinación de umbrales olfativos</span>
        </h3>

        {/* 1. Umbral operativo confiable */}
        <div className="p-3 rounded-xl bg-[#F3F5F2] border border-[#30E674]/50 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#30E674]/20 text-[#15803d] flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-bold text-slate-900 block">
              Umbral operativo confiable (sensibilidad ≥ 80% y especificidad ≥ 85%)
            </span>
            {thresholdAnalysis.reliableThresholdLevel ? (
              <div className="mt-1">
                <span className="text-sm font-black text-[#15803d]">
                  {thresholdAnalysis.reliableThresholdLevel.name}
                </span>
                <span className="text-xs text-slate-600 ml-2">
                  (Dilución: {thresholdAnalysis.reliableThresholdLevel.theoreticalRatio})
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  El perro mantiene alta precisión y control de estímulo garantizado.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 mt-1">
                Aún no hay suficientes bloques con ≥ 80% de aciertos para fijar el umbral operativo.
              </p>
            )}
          </div>
        </div>

        {/* 2. Umbral límite sensorial */}
        <div className="p-3 rounded-xl bg-[#F3F5F2] border border-[#FA963D]/50 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FA963D]/20 text-[#c2410c] flex items-center justify-center shrink-0 mt-0.5">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-bold text-slate-900 block">
              Umbral límite sensorial (sensibilidad 15% - 30%)
            </span>
            {thresholdAnalysis.sensoryLimitLevel ? (
              <div className="mt-1">
                <span className="text-sm font-black text-[#c2410c]">
                  {thresholdAnalysis.sensoryLimitLevel.name}
                </span>
                <span className="text-xs text-slate-600 ml-2">
                  (Dilución: {thresholdAnalysis.sensoryLimitLevel.theoreticalRatio})
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  El acierto decae hasta rozar la línea de azar puro (1 de 8 soportes = 12.5%).
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 mt-1">
                No se ha registrado una caída al nivel de azar aún. El perro sigue detectando en los niveles probados.
              </p>
            )}
          </div>
        </div>

        {/* 3. Alerta de frustración */}
        {thresholdAnalysis.frustratedLevels.length > 0 && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-rose-800 block">
                Criterio de exclusión activado
              </span>
              <p className="text-[11px] text-rose-700 mt-1">
                En {thresholdAnalysis.frustratedLevels.map((l) => l.name).join(', ')}, la especificidad cayó por debajo del 70%.
                El perro está marcando soportes de control para forzar el premio (adivina). Se recomienda pausar y reforzar discriminación.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Matriz de resultados */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          Matriz de resultados ({filteredTrials.length} rondas)
        </h3>

        <div className="grid grid-cols-2 gap-2 text-center">
          {/* VP */}
          <div className="p-3 rounded-xl bg-[#30E674]/15 border border-[#30E674]/40">
            <div className="flex items-center justify-between text-xs text-[#15803d] font-bold mb-1">
              <span>Acierto (VP)</span>
              <span className="text-[10px] uppercase font-semibold">Hit</span>
            </div>
            <div className="text-2xl font-black text-slate-900">{globalMetrics.vp}</div>
            <div className="text-[10px] text-slate-600 mt-1">Olor presente + alertó</div>
          </div>

          {/* FN */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300">
            <div className="flex items-center justify-between text-xs text-amber-800 font-bold mb-1">
              <span>Omisión (FN)</span>
              <span className="text-[10px] uppercase font-semibold">Miss</span>
            </div>
            <div className="text-2xl font-black text-slate-900">{globalMetrics.fn}</div>
            <div className="text-[10px] text-slate-600 mt-1">Olor presente + no alertó</div>
          </div>

          {/* FP */}
          <div className="p-3 rounded-xl bg-[#FA963D]/15 border border-[#FA963D]/40">
            <div className="flex items-center justify-between text-xs text-[#c2410c] font-bold mb-1">
              <span>Falsa alarma (FP)</span>
              <span className="text-[10px] uppercase font-semibold">False alarm</span>
            </div>
            <div className="text-2xl font-black text-slate-900">{globalMetrics.fp}</div>
            <div className="text-[10px] text-slate-600 mt-1">Control o blanco + alertó</div>
          </div>

          {/* VN */}
          <div className="p-3 rounded-xl bg-[#108BF7]/15 border border-[#108BF7]/40">
            <div className="flex items-center justify-between text-xs text-[#0284c7] font-bold mb-1">
              <span>Rechazo correcto (VN)</span>
              <span className="text-[10px] uppercase font-semibold">Correct rej.</span>
            </div>
            <div className="text-2xl font-black text-slate-900">{globalMetrics.vn}</div>
            <div className="text-[10px] text-slate-600 mt-1">Blanco + no alertó</div>
          </div>
        </div>
      </div>

      {/* Curva de sensibilidad frente a dilución */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Curva de sensibilidad vs dilución
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#30E674]"></span> ≥ 80% Meta
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#FA963D]"></span> 12.5% Azar
            </span>
          </div>
        </div>

        {levelSummaries.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No hay pasadas registradas todavía para graficar la curva.
          </div>
        ) : (
          <div className="space-y-2.5">
            {levelSummaries.map((summary) => {
              const sens = summary.sensitivity ?? 0;
              const isOperative = sens >= 80;
              const isSensoryLimit = sens <= 30;

              return (
                <div key={summary.level.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {summary.level.name}{' '}
                      <span className="text-[10px] text-slate-500">({summary.level.theoreticalRatio})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">
                        {summary.totalTrials} rondas
                      </span>
                      <span
                        className={`font-black text-xs ${
                          isOperative
                            ? 'text-[#15803d]'
                            : isSensoryLimit
                            ? 'text-[#c2410c]'
                            : 'text-[#108BF7]'
                        }`}
                      >
                        {summary.sensitivity !== null ? `${summary.sensitivity}%` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-[#FA963D] z-10"
                      style={{ left: '12.5%' }}
                      title="Línea de azar (12.5%)"
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-[#30E674] z-10"
                      style={{ left: '80%' }}
                      title="Meta (80%)"
                    />

                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOperative
                          ? 'bg-[#30E674]'
                          : isSensoryLimit
                          ? 'bg-[#FA963D]'
                          : 'bg-[#108BF7]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, sens))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rendimiento por nivel de dilución */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          Rendimiento por nivel de dilución
        </h3>

        <div className="space-y-2">
          {levelSummaries.map((summary) => (
            <div
              key={summary.level.id}
              className="p-3 rounded-xl bg-[#F3F5F2] border border-slate-200/80 flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-bold text-slate-900">{summary.level.name}</div>
                <div className="text-[11px] text-slate-600">
                  Dilución: {summary.level.theoreticalRatio} • {summary.totalTrials} rondas
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-600">
                  <span className="text-[#15803d] font-bold">VP: {summary.vp}</span>
                  <span className="text-[#c2410c] font-bold">FP: {summary.fp}</span>
                  <span className="text-[#0284c7] font-bold">VN: {summary.vn}</span>
                  <span className="text-amber-700 font-bold">FN: {summary.fn}</span>
                </div>
              </div>

              <div className="text-right space-y-0.5">
                <div className="text-xs font-bold text-slate-900">
                  Sens: {summary.sensitivity !== null ? `${summary.sensitivity}%` : '--'}
                </div>
                <div className="text-[11px] text-slate-600">
                  Espec: {summary.specificity !== null ? `${summary.specificity}%` : '--'}
                </div>
                <div className="text-[10px] text-slate-500">
                  Exact: {summary.accuracy}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
