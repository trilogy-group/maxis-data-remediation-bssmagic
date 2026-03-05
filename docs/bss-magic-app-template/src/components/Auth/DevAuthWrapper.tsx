// Development Auth Wrapper - Bypasses Cognito authentication
import React, { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';

interface DevAuthWrapperProps {
  children: React.ReactNode;
}

export const DevAuthWrapper: React.FC<DevAuthWrapperProps> = ({ children }) => {
  const { setUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Auto-login with mock user for development
    if (!isAuthenticated) {
      console.log('🔓 DEV MODE: Auto-authenticating with mock user');
      setUser({
        id: 'dev-user-123',
        name: 'Development User',
        email: 'dev@bssmagic.com',
        role: 'admin',
        organizationId: 'dev-org',
      });
    }
  }, [isAuthenticated, setUser]);

  // Render app immediately without login screen
  return <>{children}</>;
};
