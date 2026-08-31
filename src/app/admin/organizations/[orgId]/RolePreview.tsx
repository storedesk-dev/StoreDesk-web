import React from "react";
import { Monitor, Smartphone, Check } from "lucide-react";
import { getPage } from "@/config/pages";
import { RoleConfigEntry, PageConfigEntry } from "./page";

export function RolePreview({ role }: { role: RoleConfigEntry }) {
  if (!role) return null;

  const electronPages = role.accessKeys?.electron?.pages || [];
  const mobilePages = role.accessKeys?.mobile?.pages || [];

  return (
    <div className="space-y-4">
      <div className="text-sm font-bold text-gray-800 uppercase tracking-wider">
        Role Interface Preview
      </div>
      <p className="text-xs text-gray-500">
        This is a visual approximation of what this role will see when they sign into the desktop and mobile applications.
      </p>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Electron Preview */}
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-100/50">
          <div className="bg-gray-200 border-b border-gray-300 px-4 py-2 flex items-center gap-2">
            <Monitor className="h-4 w-4 text-gray-600" />
            <span className="text-xs font-bold text-gray-700">Desktop (Electron)</span>
          </div>
          <div className="p-4 flex gap-4 h-[350px]">
            {/* Sidebar */}
            <div className="w-48 bg-white border border-gray-200 rounded-lg p-3 space-y-1 overflow-y-auto shadow-sm">
              <div className="text-[10px] font-bold text-gray-400 mb-2 px-2 tracking-wider">STOREDESK</div>
              {electronPages.map((p: PageConfigEntry) => {
                const isCore = p.key === "dashboard" || p.key === "settings";
                if (!isCore && !p.enabled) return null;
                const def = getPage(p.key);
                return (
                  <div key={p.key} className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${isCore ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50 border border-transparent hover:border-gray-100"}`}>
                    {def?.label || p.key}
                  </div>
                );
              })}
            </div>
            {/* Main Content Area */}
            <div className="flex-1 bg-white border border-gray-200 rounded-lg p-5 flex flex-col shadow-sm">
              <div className="h-5 w-1/3 bg-gray-100 rounded mb-4"></div>
              <div className="h-2 w-1/4 bg-gray-100 rounded mb-8"></div>
              
              <div className="flex gap-4 mb-4">
                 <div className="h-24 flex-1 bg-blue-50/50 rounded-lg border border-blue-100"></div>
                 <div className="h-24 flex-1 bg-purple-50/50 rounded-lg border border-purple-100"></div>
                 <div className="h-24 flex-1 bg-emerald-50/50 rounded-lg border border-emerald-100"></div>
              </div>

              <div className="flex-1 border-2 border-dashed border-gray-100 rounded-lg flex items-center justify-center bg-gray-50/30">
                <span className="text-xs font-medium text-gray-400">Main Content Area</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Preview */}
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-100/50 flex flex-col justify-center items-center py-6">
          <div className="bg-gray-200 w-full border-b border-gray-300 px-4 py-2 flex items-center gap-2 absolute top-0">
             {/* Note: In a real app we'd position this properly, but for the mockup we'll just center the phone */}
          </div>
          
          <div className="w-[280px] h-[580px] bg-white rounded-[36px] border-[6px] border-gray-800 shadow-xl overflow-hidden flex flex-col relative ring-1 ring-gray-900/10">
            {/* Dynamic Island / Notch Mock */}
            <div className="absolute top-0 inset-x-0 flex justify-center z-20">
               <div className="w-24 h-5 bg-gray-800 rounded-b-xl"></div>
            </div>

            {/* Header */}
            <div className="bg-[#5e35b1] text-white p-4 pt-10 flex items-center justify-between shadow-sm relative z-10">
              <span className="text-sm font-bold tracking-wide">StoreDesk Mobile</span>
              <Smartphone className="h-4 w-4 opacity-50" />
            </div>
            
            {/* Content Body */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
              <div className="text-[10px] font-bold text-gray-400 tracking-wider uppercase ml-1">Available Modules</div>
              
              <div className="grid grid-cols-2 gap-3">
                {mobilePages.map((p: PageConfigEntry) => {
                  const isCore = p.key === "mobileDashboard";
                  if (!isCore && !p.enabled) return null;
                  const def = getPage(p.key);
                  return (
                    <div key={p.key} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center gap-2.5 aspect-square hover:border-purple-200 transition-colors">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shadow-inner ${isCore ? "bg-purple-100 text-purple-600" : "bg-blue-50 text-blue-500"}`}>
                        <Check className="h-4 w-4" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-700 leading-tight">{def?.label || p.key}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Bottom Nav */}
            <div className="h-16 bg-white border-t border-gray-100 flex items-center justify-around px-2 pb-2">
              <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center cursor-pointer">
                <div className="h-4 w-4 bg-purple-600 rounded-full"></div>
              </div>
              <div className="h-10 w-10 rounded-full hover:bg-gray-50 flex items-center justify-center transition-colors cursor-pointer">
                <div className="h-4 w-4 bg-gray-300 rounded-sm"></div>
              </div>
              <div className="h-10 w-10 rounded-full hover:bg-gray-50 flex items-center justify-center transition-colors cursor-pointer">
                <div className="h-4 w-4 border-2 border-gray-300 rounded-full"></div>
              </div>
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
}
