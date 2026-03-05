import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { cognitoService, CognitoAuthResult } from '../services/auth/cognitoService';
import { ChallengeNameType } from '@aws-sdk/client-cognito-identity-provider';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  organizationId?: string;
  tenantIds?: string[];
}

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authChallenge: {
    type: ChallengeNameType | null;
    session: string | null;
    username: string | null;
  };

  // Actions
  login: (email: string, password: string) => Promise<void>;
  changePassword: (email: string, newPassword: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setUser: (user: User) => void;
  setAuthFromIframe: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        isLoading: false,
        authChallenge: {
          type: null,
          session: null,
          username: null,
        },

        // Login action
        login: async (email: string, password: string) => {
          set({ isLoading: true, authChallenge: { type: null, session: null, username: null } });

          try {
            console.log(`🔐 AuthStore: Attempting login for ${email}`);
            const result = await cognitoService.login(email, password);

            if (result.success && result.user && result.accessToken) {
              // Map Cognito user to our User type
              const user: User = {
                id: result.user.id,
                name: result.user.name || result.user.email.split('@')[0],
                email: result.user.email,
                role: (result.user.role as User['role']) || 'user',
                organizationId: result.user.organizationId,
                tenantIds: result.user.tenantIds,
              };

              // Store tokens
              localStorage.setItem('accessToken', result.accessToken);
              localStorage.setItem('refreshToken', result.refreshToken || '');
              localStorage.setItem('idToken', result.idToken || '');

              console.log(`✅ AuthStore: Login successful for ${user.name}`);
              set({
                user,
                isAuthenticated: true,
                isLoading: false,
                authChallenge: { type: null, session: null, username: null }
              });
            } else if (result.challengeName && result.session) {
              // Handle auth challenges (like NEW_PASSWORD_REQUIRED)
              console.log(`🔐 AuthStore: Auth challenge required - ${result.challengeName}`);
              set({
                isLoading: false,
                authChallenge: {
                  type: result.challengeName,
                  session: result.session,
                  username: email,
                },
              });
            } else {
              console.error('❌ AuthStore: Login failed -', result.error);
              set({ isLoading: false });
              throw new Error(result.error || 'Login failed');
            }
          } catch (error) {
            console.error('❌ AuthStore: Login error -', error);
            set({
              isLoading: false,
              authChallenge: { type: null, session: null, username: null }
            });
            throw error;
          }
        },

        // Change password action
        changePassword: async (email: string, newPassword: string) => {
          const { authChallenge } = get();

          if (!authChallenge.session || !authChallenge.username) {
            throw new Error('No active password change session');
          }

          set({ isLoading: true });

          try {
            console.log(`🔐 AuthStore: Changing password for ${authChallenge.username}`);
            const result = await cognitoService.changePassword(
              authChallenge.username,
              newPassword,
              authChallenge.session
            );

            if (result.success && result.user && result.accessToken) {
              // Map Cognito user to our User type
              const user: User = {
                id: result.user.id,
                name: result.user.name || result.user.email.split('@')[0],
                email: result.user.email,
                role: (result.user.role as User['role']) || 'user',
                organizationId: result.user.organizationId,
                tenantIds: result.user.tenantIds,
              };

              // Store tokens
              localStorage.setItem('accessToken', result.accessToken);
              localStorage.setItem('refreshToken', result.refreshToken || '');
              localStorage.setItem('idToken', result.idToken || '');

              console.log(`✅ AuthStore: Password changed successfully for ${user.name}`);
              set({
                user,
                isAuthenticated: true,
                isLoading: false,
                authChallenge: { type: null, session: null, username: null }
              });
            } else {
              console.error('❌ AuthStore: Password change failed -', result.error);
              set({ isLoading: false });
              throw new Error(result.error || 'Password change failed');
            }
          } catch (error) {
            console.error('❌ AuthStore: Password change error -', error);
            set({ isLoading: false });
            throw error;
          }
        },

        // Logout action
        logout: () => {
          console.log('🔐 AuthStore: Logging out');

          // Clear all stored tokens
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('idToken');

          // Sign out from Cognito (client-side)
          cognitoService.signOut();

          // Reset state
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            authChallenge: { type: null, session: null, username: null }
          });
        },

        // Check authentication status
        checkAuth: async () => {
          set({ isLoading: true });

          try {
            const accessToken = localStorage.getItem('accessToken');

            // If no token, user is not authenticated
            if (!accessToken) {
              console.log('🔐 AuthStore: No access token found');
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
              });
              return;
            }

            // Verify token with Cognito
            const isValid = await cognitoService.verifyToken(accessToken);

            if (!isValid) {
              console.log('🔐 AuthStore: Token is invalid or expired');
              // Clear invalid tokens
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('idToken');

              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
              });
              return;
            }

            // Token is valid, but we need to check if we have user data
            const currentState = get();
            if (!currentState.user) {
              // We have a valid token but no user data
              // This shouldn't happen in normal flow, but let's handle it
              console.log('⚠️ AuthStore: Valid token but no user data, clearing session');
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('idToken');

              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
              });
            } else {
              console.log('✅ AuthStore: User is authenticated');
              set({ isLoading: false });
            }
          } catch (error) {
            console.error('❌ AuthStore: Auth check error -', error);
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        },

        // Set user
        setUser: (user: User) => {
          set({ user });
        },

        // Set auth state from iframe (tokens received via postMessage)
        setAuthFromIframe: () => {
          const idToken = localStorage.getItem('idToken');
          
          if (idToken) {
            try {
              // Decode JWT payload to extract user info
              const payload = JSON.parse(atob(idToken.split('.')[1]));
              
              const user: User = {
                id: payload.sub || 'iframe-user',
                name: payload.name || payload['cognito:username'] || payload.email?.split('@')[0] || 'User',
                email: payload.email || '',
                role: (payload['custom:role'] as User['role']) || 'user',
                organizationId: payload['custom:organizationId'],
                tenantIds: payload['custom:tenantIds'] ? JSON.parse(payload['custom:tenantIds']) : undefined,
              };

              console.log('✅ AuthStore: Set auth from iframe for', user.name);
              set({
                user,
                isAuthenticated: true,
                isLoading: false,
                authChallenge: { type: null, session: null, username: null }
              });
            } catch (error) {
              console.error('❌ AuthStore: Failed to decode token from iframe', error);
              // Still set as authenticated with minimal user
              set({
                user: {
                  id: 'iframe-user',
                  name: 'User',
                  email: '',
                  role: 'user',
                },
                isAuthenticated: true,
                isLoading: false,
                authChallenge: { type: null, session: null, username: null }
              });
            }
          }
        },
      }),
      {
        name: 'auth-storage',
        // Only persist user and isAuthenticated state
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: 'auth-store',
    }
  )
);

// Export for use in components
export default useAuthStore;