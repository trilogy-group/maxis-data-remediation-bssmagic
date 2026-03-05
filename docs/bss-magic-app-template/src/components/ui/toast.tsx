import React, { createContext, useContext, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface Toast {
  id: string;
  message: string;
  icon?: React.ReactNode;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, icon?: React.ReactNode, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, icon?: React.ReactNode, duration = 3000) => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, message, icon, duration };
    
    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {typeof window !== 'undefined' && createPortal(
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="bg-white border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 min-w-[300px] max-w-[400px] animate-in slide-in-from-bottom-5"
            >
              {toast.icon && (
                <div className="flex-shrink-0 text-navigation">
                  {toast.icon}
                </div>
              )}
              <p className="flex-1 text-sm text-text-primary">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 text-text-tertiary hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};


