import React, { useState, useEffect } from 'react';
import { SheetsConfig, Dog, Trial, DilutionLevel } from '../types';
import {
  exportTrialsToCSV,
  exportBackupJSON,
  syncTrialsToWebhook,
} from '../services/sheetsSync';
import { loadSampleTrials } from '../services/storage';
import {
  FileSpreadsheet,
  Download,
  Trash2,
  Plus,
  HelpCircle,
  Copy,
  Check,
  BookOpen,
  RefreshCw,
  Lock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Pencil,
  Smartphone,
  Microscope,
} from 'lucide-react';

interface SettingsViewProps {
  config: SheetsConfig;
  onSaveConfig: (config: SheetsConfig) => void;
  dogs: Dog[];
  onSaveDogs: (dogs: Dog[], activeDogId?: string) => void;
  trials: Trial[];
  onUpdateTrials: (trials: Trial[]) => void;
  levels: DilutionLevel[];
  onPullFromSheets?: () => Promise<{ success: boolean; message: string } | undefined>;
  isSyncing?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  onSaveConfig,
  dogs,
  onSaveDogs,
  trials,
  onUpdateTrials,
  levels,
  onPullFromSheets,
  isSyncing = false,
}) => {
  const [webhookUrl, setWebhookUrl] = useState<string>(config.webhookUrl);
  const [autoSync, setAutoSync] = useState<boolean>(config.autoSync);
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAppsScriptGuide, setShowAppsScriptGuide] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState<boolean>(false);

  // Gestión de perros (añadir y editar sin bloqueos de navegador)
  const [newDogName, setNewDogName] = useState<string>('');
  const [newDogHandler, setNewDogHandler] = useState<string>('');
  const [newDogBreed, setNewDogBreed] = useState<string>('');
  const [showAddDog, setShowAddDog] = useState<boolean>(false);
  const [editingDogId, setEditingDogId] = useState<string | null>(null);
  const [confirmDeleteDogId, setConfirmDeleteDogId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  // Soporte de instalación PWA en Android / Chrome
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleSaveSheetsConfig = () => {
    onSaveConfig({
      webhookUrl: webhookUrl.trim(),
      autoSync,
      lastSyncedAt: config.lastSyncedAt,
    });
    setTestResult({
      success: true,
      message: 'Configuración guardada correctamente.',
    });
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      setTestResult({
        success: false,
        message: 'Por favor, ingresa una dirección de webhook válida.',
      });
      return;
    }

    setIsTestingWebhook(true);
    setTestResult(null);

    try {
      const result = await syncTrialsToWebhook([], dogs, levels, webhookUrl);
      setTestResult({
        success: result.success,
        message: result.success
          ? 'Conexión exitosa. El webhook responde correctamente.'
          : result.message,
      });
      if (result.success) {
        onSaveConfig({ ...config, webhookUrl: webhookUrl.trim() });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: `Error al probar: ${e.message}`,
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleStartEditDog = (dog: Dog) => {
    setEditingDogId(dog.id);
    setNewDogName(dog.name);
    setNewDogBreed(dog.breed || '');
    setNewDogHandler(dog.handlerDefault || '');
    setShowAddDog(true);
  };

  const handleStartNewDog = () => {
    setEditingDogId(null);
    setNewDogName('');
    setNewDogBreed('');
    setNewDogHandler('');
    setShowAddDog(!showAddDog);
  };

  const handleSaveDogForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDogName.trim()) return;

    if (editingDogId) {
      const updated = dogs.map((d) =>
        d.id === editingDogId
          ? {
              ...d,
              name: newDogName.trim(),
              breed: newDogBreed.trim() || undefined,
              handlerDefault: newDogHandler.trim() || undefined,
            }
          : d
      );
      onSaveDogs(updated, editingDogId);
    } else {
      const newDog: Dog = {
        id: 'dog-' + Date.now(),
        name: newDogName.trim(),
        handlerDefault: newDogHandler.trim() || undefined,
        breed: newDogBreed.trim() || undefined,
      };
      const updated = [...dogs, newDog];
      onSaveDogs(updated, newDog.id);
    }

    setNewDogName('');
    setNewDogHandler('');
    setNewDogBreed('');
    setEditingDogId(null);
    setShowAddDog(false);
  };

  const handleExecuteDeleteDog = (dogId: string) => {
    const remaining = dogs.filter((d) => d.id !== dogId);
    setConfirmDeleteDogId(null);
    onSaveDogs(remaining, remaining[0]?.id);
    if (remaining.length === 0) {
      setEditingDogId(null);
      setNewDogName('');
      setNewDogBreed('');
      setNewDogHandler('');
      setShowAddDog(true);
    }
  };

  const handleLoadSample = () => {
    const sample = loadSampleTrials();
    onUpdateTrials(sample);
  };

  const handleClearAll = () => {
    onUpdateTrials([]);
    setConfirmClearAll(false);
  };

  const appsScriptCode = `function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    var contents = e.postData.contents;
    var parsed = JSON.parse(contents);
    var rowsToInsert = (parsed.action === 'sync_trials' && Array.isArray(parsed.data)) ? parsed.data : (Array.isArray(parsed) ? parsed : [parsed]);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Registro_Umbrales") || ss.insertSheet("Registro_Umbrales");
    if (sheet.getLastRow() === 0) {
      var headers = ["ID_Perro","Guía","Preparador_Juez","Fecha_Sesión","Turno","Nivel_Dilución","Dilución_Teórica","Bloque","Ronda_Bloque","Es_Blanco","Posición_Real","Posición_Marcada","Resultado","Timestamp","Notas","ID_Registro"];
      var hRange = sheet.getRange(1, 1, 1, headers.length);
      hRange.setValues([headers]).setFontWeight("bold").setBackground("#FA963D").setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }
    var existingIds = {};
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var idValues = sheet.getRange(2, 16, lastRow - 1, 1).getValues();
      for (var k = 0; k < idValues.length; k++) {
        var existingId = String(idValues[k][0] || '').trim();
        if (existingId) existingIds[existingId] = true;
      }
    }
    var newRows = [];
    for (var i = 0; i < rowsToInsert.length; i++) {
      var item = rowsToInsert[i];
      var rowId = String(item.Id_Pasada || item.ID_Registro || '').trim();
      if (rowId && existingIds[rowId]) continue;
      if (rowId) existingIds[rowId] = true;
      newRows.push([item.ID_Perro||'', item.Guia||'', item.Preparador_Juez||'', item.Fecha_Sesion||'', item.Turno||'', item.Nivel_Dilucion||'', item.Dilucion_Teorica||'', item.Bloque||1, item.Ronda_En_Bloque||1, item.Es_Blanco||'', item.Posicion_Real!==undefined?item.Posicion_Real:'', item.Posicion_Marcada!==undefined?item.Posicion_Marcada:'', item.Resultado||item.Resultado_TDS||'', item.Timestamp||new Date().toISOString(), item.Notas||'', rowId]);
    }
    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }
    lock.releaseLock();
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', inserted: newRows.length })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : '';
    if (action === 'get_trials') {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName("Registro_Umbrales") || ss.insertSheet("Registro_Umbrales");
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) return ContentService.createTextOutput(JSON.stringify({ status: 'success', count: 0, data: [] })).setMimeType(ContentService.MimeType.JSON);
      var tz = Session.getScriptTimeZone() || 'UTC';
      var values = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
      var rows = [];
      for (var i = 0; i < values.length; i++) {
        var r = values[i];
        if (!r[0] && !r[12] && !r[15]) continue;
        rows.push({
          ID_Perro: String(r[0] || ''), Guia: String(r[1] || ''), Preparador_Juez: String(r[2] || ''),
          Fecha_Sesion: r[3] instanceof Date ? Utilities.formatDate(r[3], tz, 'yyyy-MM-dd') : String(r[3] || ''),
          Turno: String(r[4] || ''), Nivel_Dilucion: String(r[5] || ''), Dilucion_Teorica: String(r[6] || ''),
          Bloque: Number(r[7]) || 1, Ronda_En_Bloque: Number(r[8]) || 1, Es_Blanco: String(r[9] || ''),
          Posicion_Real: Number(r[10]) || 0, Posicion_Marcada: Number(r[11]) || 0, Resultado: String(r[12] || ''),
          Timestamp: r[13] instanceof Date ? r[13].toISOString() : String(r[13] || ''),
          Notas: String(r[14] || ''), Id_Pasada: String(r[15] || '')
        });
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', count: rows.length, data: rows })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'online', message: 'Webhook activo' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const copyAppsScript = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="space-y-3 pb-24 max-w-xl mx-auto px-3">
      {/* Sección 1: Gestión de perros (sin bloqueos y con edición directa) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Perros registrados ({dogs.length})
          </h3>

          <button
            type="button"
            onClick={handleStartNewDog}
            className="px-2.5 py-1 rounded-lg bg-[#108BF7]/10 text-[#108BF7] hover:bg-[#108BF7]/20 text-xs flex items-center gap-1 font-bold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir perro</span>
          </button>
        </div>

        {(showAddDog || dogs.length === 0) && (
          <form
            onSubmit={handleSaveDogForm}
            className="p-3 bg-[#F3F5F2] rounded-xl border border-slate-200 space-y-2.5 text-xs"
          >
            <h4 className="font-bold text-slate-900">
              {editingDogId ? 'Editar datos del perro' : 'Registrar nuevo perro'}
            </h4>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                Nombre del perro *
              </label>
              <input
                type="text"
                required
                value={newDogName}
                onChange={(e) => setNewDogName(e.target.value)}
                placeholder="Ej. K'at"
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-[#108BF7]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  Raza (opcional)
                </label>
                <input
                  type="text"
                  value={newDogBreed}
                  onChange={(e) => setNewDogBreed(e.target.value)}
                  placeholder="Ej. Sprocker"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 focus:outline-none focus:border-[#108BF7]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  Guía habitual
                </label>
                <input
                  type="text"
                  value={newDogHandler}
                  onChange={(e) => setNewDogHandler(e.target.value)}
                  placeholder="Ej. Carlos"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 focus:outline-none focus:border-[#108BF7]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              {dogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDog(false);
                    setEditingDogId(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-medium"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-[#30E674] hover:bg-[#28c764] text-slate-950 font-bold text-xs shadow-xs"
              >
                {editingDogId ? 'Guardar cambios' : 'Guardar perro'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {dogs.map((dog) => (
            <div
              key={dog.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#F3F5F2] border border-slate-200/80 text-xs"
            >
              <div>
                <span className="font-bold text-slate-900 text-sm">{dog.name}</span>
                {dog.breed && (
                  <span className="text-slate-500 text-[11px] ml-1.5">
                    ({dog.breed})
                  </span>
                )}
                {dog.handlerDefault && (
                  <span className="text-slate-500 text-[10px] block mt-0.5">
                    Guía: {dog.handlerDefault}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStartEditDog(dog)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#108BF7] hover:bg-white transition-colors"
                  title="Editar perro"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>

                {confirmDeleteDogId === dog.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleExecuteDeleteDog(dog.id)}
                      className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold"
                    >
                      Borrar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteDogId(null)}
                      className="px-1.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-500 text-[10px]"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteDogId(dog.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition-colors"
                    title="Eliminar perro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sección 2: Instalar icono en el celular */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#108BF7] flex items-center justify-center shadow-sm shrink-0">
            <Microscope className="w-6 h-6 text-[#F3F5F2] stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>Icono de la app en tu celular</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Acceso directo en pantalla de inicio y guardado permanente
            </p>
          </div>
        </div>

        {deferredPrompt && (
          <button
            type="button"
            onClick={handleInstallPWA}
            className="w-full py-2.5 px-3 rounded-xl bg-[#108BF7] hover:bg-[#0d78d6] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
          >
            <Smartphone className="w-4 h-4" />
            <span>Instalar aplicación en el celular</span>
          </button>
        )}

        <div className="p-3 rounded-xl bg-[#F3F5F2] border border-slate-200/80 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
          <p className="font-bold text-slate-800">
            Cómo añadir el icono azul en el teléfono del equipo:
          </p>
          <p>
            • <b>En iPhone (Safari):</b> Abre el enlace en <b>Safari</b> (no dentro de WhatsApp), pulsa el botón <b>Compartir</b> y elige <b>«Añadir a pantalla de inicio»</b>.
          </p>
          <p>
            • <b>En Android (Chrome):</b> Abre el enlace en <b>Chrome</b>, toca el menú <b>⋮</b> (arriba a la derecha) y pulsa <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla de inicio»</b>.
          </p>
        </div>
      </div>

      {/* Sección 3: Conexión con Google Sheets */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#30E674]/20 text-[#15803d] flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Conexión con Google Sheets</h3>
              <p className="text-[11px] text-slate-500">Sincronización en la nube</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#30E674]/15 text-[#15803d] border border-[#30E674]/30">
            <ShieldCheck className="w-3.5 h-3.5 text-[#30E674]" />
            <span>Vinculado</span>
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          La vinculación con la hoja de cálculo central de Google Sheets está integrada en el código y protegida para evitar modificaciones accidentales.
        </p>

        <div className="flex items-center justify-between text-xs pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => {
                const nextVal = e.target.checked;
                setAutoSync(nextVal);
                onSaveConfig({
                  webhookUrl: webhookUrl.trim(),
                  autoSync: nextVal,
                  lastSyncedAt: config.lastSyncedAt,
                });
              }}
              className="rounded bg-white border-slate-300 text-[#FA963D] focus:ring-0"
            />
            <span>Sincronizar automáticamente al registrar</span>
          </label>
        </div>

        {testResult && (
          <div
            className={`p-2.5 rounded-xl text-xs font-semibold ${
              testResult.success
                ? 'bg-[#30E674]/15 border border-[#30E674]/40 text-[#15803d]'
                : 'bg-rose-50 border border-rose-200 text-rose-700'
            }`}
          >
            {testResult.message}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {onPullFromSheets && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={async () => {
                const res = await onPullFromSheets();
                if (res) {
                  setTestResult({ success: res.success, message: res.message });
                }
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-[#108BF7] hover:bg-[#0284c7] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-60"
            >
              <Download className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>{isSyncing ? 'Descargando...' : 'Descargar datos de Sheets'}</span>
            </button>
          )}
          <button
            type="button"
            disabled={isTestingWebhook}
            onClick={handleTestWebhook}
            className="w-full py-2.5 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingWebhook ? 'animate-spin text-[#FA963D]' : 'text-slate-500'}`} />
            <span>{isTestingWebhook ? 'Comprobando...' : 'Comprobar conexión'}</span>
          </button>
        </div>

        {/* Zona técnica avanzada protegida */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Ajustes avanzados de desarrollador</span>
            </span>
            {showAdvancedConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showAdvancedConfig && (
            <div className="mt-3 space-y-3 pt-3 border-t border-dashed border-slate-200">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Dirección del webhook de Google Apps Script:
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/..."
                  className="w-full bg-[#F3F5F2] border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#FA963D]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAppsScriptGuide(!showAppsScriptGuide)}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium flex items-center justify-center gap-1 transition-all"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>{showAppsScriptGuide ? 'Ocultar guía' : 'Ver guía Apps Script'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveSheetsConfig}
                  className="py-1.5 px-3 rounded-lg bg-[#FA963D] hover:bg-[#e07a22] text-slate-950 text-[11px] font-bold transition-all shadow-xs"
                >
                  <span>Guardar cambios</span>
                </button>
              </div>

              {showAppsScriptGuide && (
                <div className="p-3 rounded-xl bg-[#F3F5F2] border border-slate-200 text-xs space-y-2">
                  <h4 className="font-bold text-slate-900 text-[11px]">
                    Configuración de Apps Script:
                  </h4>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                    <li>En tu Google Sheets ve a: <b>Extensiones</b> → <b>Apps Script</b>.</li>
                    <li>Pega el código del webhook.</li>
                    <li>Haz clic en <b>Implementar</b> → <b>Nueva implementación</b> (Aplicación web, acceso: Cualquier usuario).</li>
                  </ol>

                  <button
                    type="button"
                    onClick={copyAppsScript}
                    className="w-full py-1.5 px-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 font-bold flex items-center justify-center gap-1.5 transition-all text-[11px] shadow-xs"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-[#15803d]" /> : <Copy className="w-3.5 h-3.5 text-[#FA963D]" />}
                    <span>{copiedCode ? 'Código copiado' : 'Copiar código de Google Apps Script'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sección 4: Exportación y respaldo */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Exportación y respaldo</h3>
        <p className="text-[11px] text-slate-500">
          Descarga tus datos locales en cualquier momento para análisis en Excel o respaldo.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => exportTrialsToCSV(trials, dogs, levels)}
            className="py-2.5 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#15803d]" />
            <span>Descargar CSV</span>
          </button>

          <button
            type="button"
            onClick={() => exportBackupJSON(trials, dogs)}
            className="py-2.5 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#108BF7]" />
            <span>Respaldo JSON</span>
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleLoadSample}
            className="text-xs text-[#108BF7] hover:underline font-semibold"
          >
            <span>Cargar datos de prueba</span>
          </button>

          {confirmClearAll ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold"
              >
                Confirmar borrado
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="text-[11px] text-slate-500"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="text-xs text-rose-600 hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Borrar historial</span>
            </button>
          )}
        </div>
      </div>

      {/* Sección 5: Criterios de evaluación por bloques */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2.5 text-xs text-slate-700">
        <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
          <BookOpen className="w-4 h-4 text-[#FA963D]" />
          <span>Criterios de evaluación y umbrales</span>
        </h3>
        <ul className="space-y-1.5 text-[11px] text-slate-600">
          <li>
            • <b>Aprobación de nivel:</b> Se requieren <b>2 bloques de 10 rondas con ≥ 80% de aciertos</b> (mínimo 8 de 10 en cada bloque) para superar el nivel.
          </li>
          <li>
            • <b>Umbral operativo confiable:</b> La dilución más baja con sensibilidad ≥ 80% y especificidad ≥ 85%.
          </li>
          <li>
            • <b>Umbral límite sensorial:</b> La dilución donde el acierto cae al rango de 15% a 30% (azar con 8 soportes = 12.5%).
          </li>
        </ul>
      </div>
    </div>
  );
};
