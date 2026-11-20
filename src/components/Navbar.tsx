import React from 'react';
import { Target, BarChart3, History, Settings, Cloud, CloudOff, Microscope } from 'lucide-react';

export type TabType = 'logger' | 'analytics' | 'history' | 'settings';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  pendingSyncCount: number;
  hasWebhook: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingSyncCount,
  hasWebhook,
}) => {
  const tabs = [
    { id: 'logger' as TabType, label: 'Registro', icon: Target },
    { id: 'analytics' as TabType, label: 'Análisis', icon: BarChart3 },
    { id: 'history' as TabType, label: 'Historial', icon: History, badge: pendingSyncCount > 0 ? pendingSyncCount : null },
    { id: 'settings' as TabType, label: 'Ajustes', icon: Settings },
  ];

  return (
    <>
      {/* Barra superior */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-2.5 safe-area-top">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#108BF7] flex items-center justify-center shadow-xs">
              <Microscope className="w-4 h-4 text-[#F3F5F2] stroke-[2.3]" />
            </div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900">
              Umbrales olfativos
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {hasWebhook ? (
              pendingSyncCount > 0 ? (
                <div
                  title={`${pendingSyncCount} pasadas pendientes de sincronizar`}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FA963D]/15 text-[#c2410c]"
                >
                  <CloudOff className="w-3.5 h-3.5 animate-pulse" />
                  <span>{pendingSyncCount} pend.</span>
                </div>
              ) : (
                <div
                  title="Conectado a Google Sheets"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#30E674]/15 text-[#15803d]"
                >
                  <Cloud className="w-3.5 h-3.5 text-[#16a34a]" />
                  <span>Sheets ok</span>
                </div>
              )
            ) : (
              <div
                title="Modo local (Google Sheets no configurado)"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600"
              >
                <span>Local</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navegación móvil inferior */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 safe-area-bottom shadow-lg">
        <div className="max-w-xl mx-auto flex items-center justify-around px-2 py-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-150 ${
                  isActive
                    ? 'text-[#FA963D] font-bold'
                    : 'text-slate-500 hover:text-slate-800 active:scale-95'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                  {tab.badge && (
                    <span className="absolute -top-1.5 -right-2.5 px-1.5 min-w-4 h-4 rounded-full bg-[#FA963D] text-[10px] font-bold text-white flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] mt-0.5">{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 w-8 h-0.5 bg-[#FA963D] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
