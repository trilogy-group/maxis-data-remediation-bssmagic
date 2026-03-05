import React, { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { LoginForm } from './LoginForm';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    // Check if user has valid session on mount
    checkAuth();
  }, [checkAuth]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ backgroundColor: '#001D3D' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading BSS Magic...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <LoginForm />;
  }

  // User is authenticated, render the app
  return <>{children}</>;
};