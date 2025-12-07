
import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // 5 seconds duration
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  // Modern, cleaner style: White bg, colored icon/text, side border
  const styles = {
    success: { border: 'border-l-4 border-emerald-500', iconColor: 'text-emerald-500', icon: <CheckCircle /> },
    error: { border: 'border-l-4 border-red-500', iconColor: 'text-red-500', icon: <AlertCircle /> },
    warning: { border: 'border-l-4 border-amber-500', iconColor: 'text-amber-500', icon: <AlertCircle /> },
    info: { border: 'border-l-4 border-blue-500', iconColor: 'text-blue-500', icon: <Info /> },
  };

  const currentStyle = styles[toast.type];

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] animate-in zoom-in-95 fade-in duration-300 pointer-events-none">
      <div className={`bg-white px-6 py-5 rounded-lg shadow-2xl shadow-slate-400/20 flex items-start gap-4 min-w-[320px] max-w-md border border-slate-100 ${currentStyle.border} pointer-events-auto`}>
        <div className={`shrink-0 mt-0.5 ${currentStyle.iconColor}`}>
            {React.cloneElement(currentStyle.icon as any, { className: "w-6 h-6" })}
        </div>
        <div className="flex-1 text-sm font-medium text-slate-700 leading-relaxed">
          {toast.message}
        </div>
        <button onClick={onClose} className="p-1 -mt-1 -mr-2 text-slate-400 hover:text-slate-600 rounded transition shrink-0">
            <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
