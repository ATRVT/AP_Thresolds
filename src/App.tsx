import React, { useState, useMemo } from 'react';
import { Navbar, TabType } from './components/Navbar';
import { LoggerView } from './components/LoggerView';
import { AnalyticsView } from './components/AnalyticsView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { Trial, Dog, SheetsConfig } from './types';
import { OFFICIAL_DILUTION_TABLE } from './constants/dilutions';
import { getTrialOutcome } from './utils/tdsMetrics';
import {
  loadDogs,
  saveDogs,
  loadTrials,
  saveTrials,
  addTrial,
  removeTrial,
  loadSheetsConfig,
  saveSheetsConfig,
  loadSessionDefaults,
  saveSessionDefaults,
  SessionDefaults,
} from './services/storage';
import { syncTrialsToWebhook } from './services/sheetsSync';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('logger');
  const [dogs, setDogs] = useState<Dog[]>(() => loadDogs());
  const [trials, setTrials] = useState<Trial[]>(() => loadTrials());
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig>(() => loadSheetsConfig());
  const [sessionDefaults, setSessionDefaults] = useState<SessionDefaults>(() => loadSessionDefaults());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const pendingSyncCount = useMemo(
    () => trials.filter((t) => !t.syncedToSheets).length,
    [trials]
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleSaveTrial = (newTrial: Trial) => {
    // Guardado local inmediato sin interrumpir con toasts cada ronda
    const updated = addTrial(newTrial);
    setTrials(updated);
  };

  const handleUndoTrial = () => {
    if (trials.length === 0) return;
    const lastTrial = trials[0];
    const outcome = getTrialOutcome(lastTrial);
    const updated = removeTrial(lastTrial.id);
    setTrials(updated);
    showToast(`Deshecha última pasada (${outcome})`);
  };

  const handleDeleteTrial = (trialId: string) => {
    const updated = removeTrial(trialId);
    setTrials(updated);
    showToast('Pasada eliminada.');
  };

  const handleSyncPending = async () => {
    if (!sheetsConfig.webhookUrl) {
      setActiveTab('settings');
      showToast('Por favor, configura la dirección de Google Sheets primero.');
      return;
    }

    const pending = trials.filter((t) => !t.syncedToSheets);
    if (pending.length === 0) {
      showToast('Todas las pasadas ya están sincronizadas.');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncTrialsToWebhook(pending, dogs, OFFICIAL_DILUTION_TABLE, sheetsConfig.webhookUrl);
      if (result.success) {
        const pendingIds = new Set(pending.map((p) => p.id));
        const updated = trials.map((t) => (pendingIds.has(t.id) ? { ...t, syncedToSheets: true } : t));
        saveTrials(updated);
        setTrials(updated);
        showToast(`${pending.length} pasadas sincronizadas con Google Sheets`);
      } else {
        showToast(`Error al sincronizar: ${result.message}`);
      }
    } catch (e: any) {
      showToast(`Error de conexión: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateDefaults = (newDefaults: SessionDefaults) => {
    setSessionDefaults(newDefaults);
    saveSessionDefaults(newDefaults);
  };

  const handleUpdateDogs = (newDogs: Dog[], activeDogId?: string) => {
    setDogs(newDogs);
    saveDogs(newDogs);

    if (newDogs.length > 0 && sessionDefaults) {
      const targetDog =
        (activeDogId && newDogs.find((d) => d.id === activeDogId)) ||
        newDogs.find((d) => d.id === sessionDefaults.dogId) ||
        newDogs[newDogs.length - 1];

      if (targetDog) {
        const nextDefaults: SessionDefaults = {
          ...sessionDefaults,
          dogId: targetDog.id,
          handler: targetDog.handlerDefault || sessionDefaults.handler,
        };
        setSessionDefaults(nextDefaults);
        saveSessionDefaults(nextDefaults);
      }
    }
    showToast('Registro de perros actualizado');
  };

  const handleUpdateConfig = (newConfig: SheetsConfig) => {
    setSheetsConfig(newConfig);
    saveSheetsConfig(newConfig);
  };

  const handleUpdateAllTrials = (newTrials: Trial[]) => {
    setTrials(newTrials);
    saveTrials(newTrials);
  };

  if (!sessionDefaults) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F5F2] text-slate-500">
        Iniciando umbrales olfativos...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F5F2] text-slate-800 flex flex-col antialiased selection:bg-[#FA963D] selection:text-white">
      {/* Barra de navegación */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingSyncCount={pendingSyncCount}
        hasWebhook={!!sheetsConfig.webhookUrl}
      />

      {/* Contenido principal */}
      <main className="flex-1 pt-3 pb-8">
        {activeTab === 'logger' && (
          <LoggerView
            dogs={dogs}
            levels={OFFICIAL_DILUTION_TABLE}
            trials={trials}
            sessionDefaults={sessionDefaults}
            hasWebhook={!!sheetsConfig.webhookUrl}
            isSyncing={isSyncing}
            onSaveTrial={handleSaveTrial}
            onUndoTrial={handleUndoTrial}
            onUpdateDefaults={handleUpdateDefaults}
            onSyncPending={handleSyncPending}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            trials={trials}
            dogs={dogs}
            levels={OFFICIAL_DILUTION_TABLE}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            trials={trials}
            dogs={dogs}
            levels={OFFICIAL_DILUTION_TABLE}
            hasWebhook={!!sheetsConfig.webhookUrl}
            onDeleteTrial={handleDeleteTrial}
            onSyncPending={handleSyncPending}
            isSyncing={isSyncing}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            config={sheetsConfig}
            onSaveConfig={handleUpdateConfig}
            dogs={dogs}
            onSaveDogs={handleUpdateDogs}
            trials={trials}
            onUpdateTrials={handleUpdateAllTrials}
            levels={OFFICIAL_DILUTION_TABLE}
          />
        )}
      </main>

      {/* Mensaje flotante tipo toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;
