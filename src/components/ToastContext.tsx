"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Toasts for the admin console and the account pages.
 *
 * The entrance is a CSS keyframe (`.sd-toast` in globals.css), not framer-motion: this provider
 * wraps every page from the root layout, so whatever it imports ships on the public site too.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    let msg = message;
    if (typeof message === "object") {
      try { msg = JSON.stringify(message); } catch { msg = String(message); }
    }

    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message: msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`sd-toast pointer-events-auto flex items-center justify-between gap-3 w-80 max-w-[calc(100vw-2rem)] rounded-xl px-4 py-3 shadow-lg ${
              t.type === "error"
                ? "bg-red-50 text-red-900 border border-red-200"
                : t.type === "success"
                ? "bg-green-50 text-green-900 border border-green-200"
                : "bg-white text-gray-900 border border-gray-200"
            }`}
          >
            <p className="text-sm font-medium leading-tight">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="shrink-0 rounded-md p-1 opacity-50 hover:bg-black/5 hover:opacity-100 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
