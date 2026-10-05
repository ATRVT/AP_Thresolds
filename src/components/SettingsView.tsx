import React, { useState } from 'react';
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
} from 'lucide-react';

interface SettingsViewProps {
  config: SheetsConfig;
  onSaveConfig: (config: SheetsConfig) => void;
  dogs: Dog[];
  onSaveDogs: (dogs: Dog[]) => void;
  trials: Trial[];
  onUpdateTrials: (trials: Trial[]) => void;
  levels: DilutionLevel[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  onSaveConfig,
  dogs,
  onSaveDogs,
  trials,
  onUpdateTrials,
  levels,
}) => {
  const [webhookUrl, setWebhookUrl] = useState<string>(config.webhookUrl);
  const [autoSync, setAutoSync] = useState<boolean>(config.autoSync);
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAppsScriptGuide, setShowAppsScriptGuide] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState<boolean>(false);

  // Formulario nuevo perro
  const [newDogName, setNewDogName] = useState<string>('');
  const [newDogHandler, setNewDogHandler] = useState<string>('');
  const [newDogBreed, setNewDogBreed] = useState<string>('');
  const [showAddDog, setShowAddDog] = useState<boolean>(false);

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

  const handleAddDog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDogName.trim()) return;

    const newDog: Dog = {
      id: 'dog-' + Date.now(),
      name: newDogName.trim(),
      handlerDefault: newDogHandler.trim() || undefined,
      breed: newDogBreed.trim() || undefined,
    };

    const updated = [...dogs, newDog];
    onSaveDogs(updated);
    setNewDogName('');
    setNewDogHandler('');
    setNewDogBreed('');
    setShowAddDog(false);
  };

  const handleDeleteDog = (dogId: string) => {
    if (dogs.length <= 1) {
      alert('Debe existir al menos un perro registrado.');
      return;
    }
    if (confirm('¿Eliminar este perro del registro?')) {
      onSaveDogs(dogs.filter((d) => d.id !== dogId));
    }
  };

  const handleLoadSample = () => {
    if (confirm('¿Deseas cargar 20 pasadas organizadas en bloques de 10 rondas para probar la app?')) {
      const sample = loadSampleTrials();
      onUpdateTrials(sample);
      alert('Datos de prueba cargados. Puedes explorar las métricas y curvas en la pestaña de análisis.');
    }
  };

  const handleClearAll = () => {
    if (confirm('¿Estás seguro de que deseas borrar permanentemente todas las pasadas? Esta acción no se puede deshacer.')) {
      onUpdateTrials([]);
      alert('Historial borrado.');
    }
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
    var newRows = [];
    for (var i = 0; i < rowsToInsert.length; i++) {
      var item = rowsToInsert[i];
      newRows.push([item.ID_Perro||'', item.Guia||'', item.Preparador_Juez||'', item.Fecha_Sesion||'', item.Turno||'', item.Nivel_Dilucion||'', item.Dilucion_Teorica||'', item.Bloque||1, item.Ronda_En_Bloque||1, item.Es_Blanco||'', item.Posicion_Real!==undefined?item.Posicion_Real:'', item.Posicion_Marcada!==undefined?item.Posicion_Marcada:'', item.Resultado||item.Resultado_TDS||'', item.Timestamp||new Date().toISOString(), item.Notas||'', item.Id_Pasada||'']);
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
  return ContentService.createTextOutput(JSON.stringify({ status: 'online', message: 'Webhook activo' })).setMimeType(ContentService.MimeType.JSON);
}`;

  const copyAppsScript = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="space-y-3.5 pb-24 max-w-xl mx-auto px-3.5">
      {/* Sección 1: Conexión con Google Sheets */}
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
          La vinculación con la hoja de cálculo central de Google Sheets está integrada en el código y protegida para evitar modificaciones accidentales por parte de los entrenadores.
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

        <button
          type="button"
          disabled={isTestingWebhook}
          onClick={handleTestWebhook}
          className="w-full py-2.5 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isTestingWebhook ? 'animate-spin text-[#FA963D]' : 'text-slate-500'}`} />
          <span>{isTestingWebhook ? 'Comprobando conexión...' : 'Comprobar conexión con la hoja'}</span>
        </button>

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
            <div className="mt-3 space-y-3 pt-3 border-t border-dashed border-slate-200 animate-in fade-in">
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
                <div className="p-3 rounded-xl bg-[#F3F5F2] border border-slate-200 text-xs space-y-2 animate-in fade-in">
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

      {/* Sección 2: Gestión de perros */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>Perros registrados ({dogs.length})</span>
          </h3>

          <button
            type="button"
            onClick={() => setShowAddDog(!showAddDog)}
            className="text-xs text-[#108BF7] hover:underline flex items-center gap-1 font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo perro</span>
          </button>
        </div>

        {showAddDog && (
          <form onSubmit={handleAddDog} className="p-3 bg-[#F3F5F2] rounded-xl border border-slate-200 space-y-2 text-xs animate-in fade-in">
            <h4 className="font-bold text-slate-900">Añadir perro al equipo</h4>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Nombre del perro *</label>
              <input
                type="text"
                required
                value={newDogName}
                onChange={(e) => setNewDogName(e.target.value)}
                placeholder="Ej. Kira"
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Raza (opcional)</label>
                <input
                  type="text"
                  value={newDogBreed}
                  onChange={(e) => setNewDogBreed(e.target.value)}
                  placeholder="Ej. Malinois"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Guía habitual</label>
                <input
                  type="text"
                  value={newDogHandler}
                  onChange={(e) => setNewDogHandler(e.target.value)}
                  placeholder="Ej. Carlos"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddDog(false)}
                className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-[#30E674] text-slate-950 font-bold text-xs shadow-xs"
              >
                Guardar perro
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {dogs.map((dog) => (
            <div
              key={dog.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#F3F5F2] border border-slate-200 text-xs"
            >
              <div>
                <span className="font-bold text-slate-900 text-sm">{dog.name}</span>
                <span className="text-slate-500 text-[11px] ml-2">
                  {dog.breed || 'Sin raza especificada'}
                </span>
                {dog.handlerDefault && (
                  <span className="text-slate-600 text-[10px] block mt-0.5">
                    Guía predeterminado: {dog.handlerDefault}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDeleteDog(dog.id)}
                className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                title="Eliminar perro"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sección 3: Exportación y respaldo */}
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

          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-rose-600 hover:underline flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>Borrar historial</span>
          </button>
        </div>
      </div>

      {/* Sección 4: Criterios de evaluación por bloques */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2.5 text-xs text-slate-700">
        <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
          <BookOpen className="w-4 h-4 text-[#FA963D]" />
          <span>Criterios de evaluación y umbrales</span>
        </h3>
        <p className="text-[11px] leading-relaxed text-slate-600">
          La evaluación se organiza en <b>bloques de 10 rondas</b> por nivel de dilución para determinar el umbral de detección:
        </p>
        <ul className="space-y-1.5 text-[11px] text-slate-600">
          <li>
            • <b>Aprobación del bloque:</b> Se requiere un mínimo de <b>8 aciertos en 10 rondas (≥ 80%)</b> para considerar superado el nivel.
          </li>
          <li>
            • <b>Umbral operativo confiable:</b> La dilución más baja donde el perro mantiene sensibilidad ≥ 80% y especificidad ≥ 85%.
          </li>
          <li>
            • <b>Umbral límite sensorial:</b> La dilución donde la tasa de acierto cae al rango de 15% a 30% (zona de azar puro con 8 soportes = 12.5%).
          </li>
          <li>
            • <b>Criterio de exclusión:</b> Si la especificidad cae por debajo del 70%, el perro está adivinando en los controles y requiere pausar el ensayo.
          </li>
        </ul>
      </div>
    </div>
  );
};
