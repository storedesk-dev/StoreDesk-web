import React, { useState, useEffect } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { z } from 'zod';

const ConfigSchema = z.object({
  posIntegration: z.literal("verifone_commander"),
  posIpAddress: z.string().optional(),
  posUsername: z.string().optional(),
  posPassword: z.string().optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional()
}).strict();

interface JsonEditorProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
}

export function JsonEditor({ value, onChange, label, placeholder }: JsonEditorProps) {
  const [internalValue, setInternalValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInternalValue(val);
    
    if (!val.trim()) {
      setIsValid(true);
      setError(null);
      onChange(val);
      return;
    }

    try {
      const parsed = JSON.parse(val);
      ConfigSchema.parse(parsed);
      setIsValid(true);
      setError(null);
      onChange(val);
    } catch (err: unknown) {
      setIsValid(false);
      // Format Zod errors nicely if it's a ZodError
      if (err instanceof z.ZodError) {
        setError(err.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Invalid format");
      }
    }
  };

  const handleFormat = () => {
    if (!internalValue.trim()) return;
    try {
      const parsed = JSON.parse(internalValue);
      const formatted = JSON.stringify(parsed, null, 2);
      setInternalValue(formatted);
      setIsValid(true);
      setError(null);
      onChange(formatted);
    } catch {
      // Cannot format invalid JSON
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
        <button 
          onClick={handleFormat}
          disabled={!isValid || !internalValue.trim()}
          className="text-xs text-[var(--sd-blue)] hover:underline disabled:opacity-50 disabled:hover:no-underline"
        >
          Format JSON
        </button>
      </div>
      
      <div className={`relative rounded-xl border ${isValid ? 'border-gray-300 focus-within:border-[var(--sd-blue)] focus-within:ring-1 focus-within:ring-[var(--sd-blue)]' : 'border-red-400 focus-within:ring-1 focus-within:ring-red-400'} transition-all overflow-hidden`}>
        <textarea
          value={internalValue || ""}
          onChange={handleChange}
          placeholder={placeholder || "{}"}
          className="w-full h-64 p-4 font-mono text-sm bg-gray-50 outline-none resize-y"
          spellCheck={false}
        />
        <div className="absolute top-3 right-3 flex items-center">
          {internalValue.trim() && (
            isValid ? (
              <span className="flex items-center text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                <Check className="w-3 h-3 mr-1" /> Valid
              </span>
            ) : (
              <span className="flex items-center text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded-md border border-red-100">
                <X className="w-3 h-3 mr-1" /> Invalid
              </span>
            )
          )}
        </div>
      </div>
      
      {!isValid && error && (
        <div className="flex items-start gap-1.5 text-xs text-red-600 mt-1">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
