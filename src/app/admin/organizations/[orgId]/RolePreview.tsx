import React from "react";
import { Monitor, Smartphone, Check } from "lucide-react";
import { getPage } from "@/config/pages";
import { RoleConfigEntry, PageConfigEntry } from "./page";

export function RolePreview({ role, mode }: { role: RoleConfigEntry; mode: "electron" | "mobile" }) {
  if (!role) return null;

  const electronPages = role.accessKeys?.electron?.pages || [];
  const mobilePages = role.accessKeys?.mobile?.pages || [];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      {mode === "electron" && (
        <div className="w-full max-w-2xl border border-gray-200 rounded-xl overflow-hidden bg-white shadow-md">
          <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
            <Monitor className="h-4 w-4 text-gray-500" />
            <span className="text-xs font-bold text-gray-600">StoreDesk Desktop UI</span>
          </div>
          <div className="p-4 flex gap-4 h-[400px]">
            {/* Sidebar */}
            <div className="w-56 bg-gray-50 border border-gray-100 rounded-lg p-3 flex flex-col gap-1 overflow-y-auto">
              <div className="text-[10px] font-bold text-gray-400 mb-3 px-2 tracking-widest">STOREDESK</div>
              {electronPages.map((p: PageConfigEntry) => {
                const isCore = p.key === "dashboard" || p.key === "settings";
                if (!isCore && !p.enabled) return null;
                const def = getPage(p.key);
                return (
                  <div key={p.key} className={`px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${isCore ? "bg-[var(--sd-blue)]/10 text-[var(--sd-blue)]" : "text-gray-600 hover:bg-gray-100 border border-transparent"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isCore ? "bg-[var(--sd-blue)]" : "bg-gray-300"}`}></div>
                    {def?.label || p.key}
                  </div>
                );
              })}
            </div>
            {/* Main Content Area */}
            <div className="flex-1 bg-white border border-gray-100 rounded-lg p-6 flex flex-col shadow-sm">
              <div className="h-6 w-1/3 bg-gray-100 rounded-md mb-4"></div>
              <div className="h-2 w-1/4 bg-gray-50 rounded mb-8"></div>
              
              <div className="flex gap-4 mb-6">
                 <div className="h-28 flex-1 bg-blue-50/50 rounded-xl border border-blue-100"></div>
                 <div className="h-28 flex-1 bg-purple-50/50 rounded-xl border border-purple-100"></div>
                 <div className="h-28 flex-1 bg-emerald-50/50 rounded-xl border border-emerald-100"></div>
              </div>

              <div className="flex-1 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center bg-gray-50/30">
                <span className="text-sm font-medium text-gray-400">Content Area</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === "mobile" && (
        <div className="flex flex-col items-center">
          <div className="w-[300px] h-[620px] bg-white rounded-[40px] border-[8px] border-gray-900 shadow-2xl overflow-hidden flex flex-col relative ring-1 ring-gray-900/10">
            {/* Dynamic Island / Notch Mock */}
            <div className="absolute top-0 inset-x-0 flex justify-center z-20">
               <div className="w-28 h-6 bg-gray-900 rounded-b-2xl"></div>
            </div>

            {/* Header */}
            <div className="bg-[#5e35b1] text-white p-5 pt-12 flex items-center justify-between shadow-md relative z-10">
              <span className="text-base font-bold tracking-wide">StoreDesk</span>
              <Smartphone className="h-5 w-5 opacity-70" />
            </div>
            
            {/* Content Body */}
            <div className="flex-1 p-5 overflow-y-auto bg-gray-50 space-y-5">
              <div className="text-[11px] font-bold text-gray-400 tracking-wider uppercase ml-1">Modules</div>
              
              <div className="grid grid-cols-2 gap-3.5">
                {mobilePages.map((p: PageConfigEntry) => {
                  const isCore = p.key === "mobileDashboard";
                  if (!isCore && !p.enabled) return null;
                  const def = getPage(p.key);
                  return (
                    <div key={p.key} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center gap-3 aspect-square hover:border-purple-200 transition-colors">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-inner ${isCore ? "bg-purple-100 text-purple-600" : "bg-blue-50 text-blue-500"}`}>
                        <Check className="h-5 w-5" />
                      </div>
                      <span className="text-[11px] font-bold text-gray-700 leading-tight">{def?.label || p.key}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Bottom Nav */}
            <div className="h-20 bg-white border-t border-gray-100 flex items-center justify-around px-2 pb-4 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
              <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center cursor-pointer">
                <div className="h-5 w-5 bg-purple-600 rounded-full"></div>
              </div>
              <div className="h-12 w-12 rounded-full hover:bg-gray-50 flex items-center justify-center transition-colors cursor-pointer">
                <div className="h-5 w-5 bg-gray-300 rounded-md"></div>
              </div>
              <div className="h-12 w-12 rounded-full hover:bg-gray-50 flex items-center justify-center transition-colors cursor-pointer">
                <div className="h-5 w-5 border-[2.5px] border-gray-300 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
