import React, { useState, useMemo } from 'react';
import { Trial, Dog, DilutionLevel } from '../types';
import { getOutcomeInfo, getTrialOutcome } from '../utils/tdsMetrics';
import {
  Trash2,
  Cloud,
  CloudOff,
  Filter,
  RefreshCw,
  Clock,
} from 'lucide-react';

interface HistoryViewProps {
  trials: Trial[];
  dogs: Dog[];
  levels: DilutionLevel[];
  hasWebhook: boolean;
  onDeleteTrial: (id: string) => void;
  onSyncPending: () => void;
  isSyncing: boolean;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  trials,
  dogs,
  levels,
  hasWebhook,
  onDeleteTrial,
  onSyncPending,
  isSyncing,
}) => {
  const [filterDog, setFilterDog] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');

  const dogsMap = useMemo(() => new Map(dogs.map((d) => [d.id, d])), [dogs]);
  const levelsMap = useMemo(() => new Map(levels.map((l) => [l.id, l])), [levels]);

  const filteredTrials = useMemo(() => {
    return trials.filter((t) => {
      const outcome = getTrialOutcome(t);
      if (filterDog !== 'all' && t.dogId !== filterDog) return false;
      if (filterLevel !== 'all' && t.dilutionId !== filterLevel) return false;
      if (filterOutcome !== 'all' && outcome !== filterOutcome) return false;
      return true;
    });
  }, [trials, filterDog, filterLevel, filterOutcome]);

  const pendingSyncTrials = useMemo(() => trials.filter((t) => !t.syncedToSheets), [trials]);

  return (
    <div className="space-y-3.5 pb-24 max-w-xl mx-auto px-3.5">
      {/* Barra de sincronización rápida */}
      {hasWebhook && pendingSyncTrials.length > 0 && (
        <div className="p-3 rounded-2xl bg-[#FA963D]/15 border border-[#FA963D]/40 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-[#c2410c] font-semibold">
            <CloudOff className="w-4 h-4 text-[#FA963D] shrink-0" />
            <span>{pendingSyncTrials.length} pasadas pendientes de sincronizar en Google Sheets</span>
          </div>
          <button
            type="button"
            disabled={isSyncing}
            onClick={onSyncPending}
            className="px-3 py-1.5 rounded-xl bg-[#FA963D] hover:bg-[#e07a22] text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Enviando...' : 'Sincronizar'}</span>
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Filter className="w-3.5 h-3.5 text-[#FA963D]" />
          <span>Filtrar historial ({filteredTrials.length} de {trials.length})</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Perro */}
          <select
            value={filterDog}
            onChange={(e) => setFilterDog(e.target.value)}
            aria-label="Filtrar por perro"
            className="w-full bg-[#F3F5F2] border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-900"
          >
            <option value="all">Todos los perros</option>
            {dogs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Nivel */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            aria-label="Filtrar por nivel"
            className="w-full bg-[#F3F5F2] border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-900"
          >
            <option value="all">Todos los niveles</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          {/* Resultado */}
          <select
            value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value)}
            aria-label="Filtrar por resultado"
            className="w-full bg-[#F3F5F2] border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-900"
          >
            <option value="all">Todos los resultados</option>
            <option value="VP">VP (Aciertos)</option>
            <option value="FP">FP (Falsas alarmas)</option>
            <option value="VN">VN (Rechazos correctos)</option>
            <option value="FN">FN (Omisiones)</option>
          </select>
        </div>
      </div>

      {/* Lista de pasadas */}
      {filteredTrials.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
          No se encontraron pasadas con los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTrials.map((trial) => {
            const dog = dogsMap.get(trial.dogId);
            const level = levelsMap.get(trial.dilutionId);
            const outcome = getTrialOutcome(trial);
            const outcomeInfo = getOutcomeInfo(outcome);
            const trialTime = new Date(trial.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={trial.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs hover:border-slate-300 transition-all flex items-center justify-between gap-3"
              >
                {/* Indicador de resultado lateral */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${outcomeInfo.color}`}
                  >
                    {outcomeInfo.code}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {dog ? dog.name : 'Perro'}
                      </span>
                      <span className="text-xs font-semibold text-[#108BF7]">
                        {level ? level.name : trial.dilutionId}
                      </span>
                      {trial.blockNumber && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          B{trial.blockNumber} • R{trial.roundInBlock || 1}/10
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                      <span>
                        Real:{' '}
                        <b className={trial.isBlank ? 'text-[#c2410c]' : 'text-[#108BF7]'}>
                          {trial.isBlank ? '0 (Blanco)' : `Soporte ${trial.realPosition}`}
                        </b>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>
                        Marcó:{' '}
                        <b className={trial.markedPosition === 0 ? 'text-slate-500' : 'text-[#15803d]'}>
                          {trial.markedPosition === 0 ? '0 (No marcó)' : `Soporte ${trial.markedPosition}`}
                        </b>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {trial.sessionDate} {trialTime} ({trial.sessionTurn})
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>Guía: {trial.handler}</span>
                    </div>
                  </div>
                </div>

                {/* Acciones y estado de sincronización */}
                <div className="flex flex-col items-end justify-between self-stretch">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Eliminar esta pasada permanentemente?')) {
                        onDeleteTrial(trial.id);
                      }
                    }}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Eliminar pasada"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="mt-auto">
                    {trial.syncedToSheets ? (
                      <span
                        title="Sincronizado en Google Sheets"
                        className="text-[#15803d] flex items-center gap-1 text-[10px] font-semibold"
                      >
                        <Cloud className="w-3.5 h-3.5" />
                        <span>Sincronizado</span>
                      </span>
                    ) : (
                      <span
                        title="Guardado localmente (pendiente de sync)"
                        className="text-[#c2410c] flex items-center gap-1 text-[10px] font-semibold"
                      >
                        <CloudOff className="w-3.5 h-3.5" />
                        <span>Local</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
