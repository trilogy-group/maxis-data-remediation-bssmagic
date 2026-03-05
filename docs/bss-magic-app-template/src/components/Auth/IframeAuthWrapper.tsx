import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { LoginForm } from './LoginForm';

interface IframeAuthWrapperProps {
  children: React.ReactNode;
}

// Environment variable to control login fallback behavior
const showLogin = import.meta.env.VITE_SHOW_LOGIN === 'true';

/**
 * IframeAuthWrapper - Authentication wrapper for iframe-embedded apps
 * 
 * Behavior controlled by VITE_SHOW_LOGIN environment variable:
 * - VITE_SHOW_LOGIN=false (default): Wait for auth tokens via postMessage from parent
 * - VITE_SHOW_LOGIN=true: Show login form if no tokens (standalone mode)
 * 
 * Expected message format from parent:
 * {
 *   type: 'BSS_MAGIC_AUTH',
 *   payload: {
 *     accessToken: string,
 *     refreshToken: string,
 *     idToken: string
 *   }
 * }
 */
export const IframeAuthWrapper: React.FC<IframeAuthWrapperProps> = ({ children }) => {
  const { isAuthenticated, isLoading, checkAuth, setAuthFromIframe } = useAuthStore();
  
  // Local gate: In iframe mode starts false, becomes true only after postMessage
  // In standalone mode starts true (skip waiting for postMessage)
  const [isReady, setIsReady] = useState(showLogin);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  useEffect(() => {
    // Standalone mode: use standard auth flow
    if (showLogin) {
      console.log('🔐 IframeAuthWrapper: Standalone mode, checking auth...');
      checkAuth().then(() => {
        setIsReady(true);
        setShowLoginForm(!useAuthStore.getState().isAuthenticated);
      });
      return;
    }

    // Iframe mode: set up message listener
    console.log('🔐 IframeAuthWrapper: Iframe mode, waiting for postMessage...');
    
    messageHandlerRef.current = (event: MessageEvent) => {
      if (event.data?.type === 'BSS_MAGIC_AUTH') {
        console.log('📨 IframeAuthWrapper: BSS_MAGIC_AUTH received', {
          origin: event.origin,
          hasAccessToken: !!event.data.payload?.accessToken,
          hasIdToken: !!event.data.payload?.idToken,
        });
        
        const { accessToken, refreshToken, idToken } = event.data.payload;
        
        // Store tokens
        if (accessToken) localStorage.setItem('accessToken', accessToken);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        if (idToken) localStorage.setItem('idToken', idToken);
        
        // Update auth state and open the gate
        setAuthFromIframe();
        setIsReady(true);
        console.log('✅ IframeAuthWrapper: Auth complete, rendering app');
      }
    };

    window.addEventListener('message', messageHandlerRef.current);
    
    return () => {
      if (messageHandlerRef.current) {
        window.removeEventListener('message', messageHandlerRef.current);
      }
    };
  }, [checkAuth, setAuthFromIframe]);

  // Standalone mode: show login if auth check complete and not authenticated
  if (showLogin && showLoginForm && !isAuthenticated) {
    return <LoginForm />;
  }

  // Gate: wait until ready
  if (!isReady || isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ backgroundColor: '#001D3D' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white text-lg">Loading BSS Magic...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default IframeAuthWrapper;

