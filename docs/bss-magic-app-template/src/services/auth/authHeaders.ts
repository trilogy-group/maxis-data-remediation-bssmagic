/**
 * Utility function to get authorization headers for API requests
 * Uses Cognito ID token for all services
 */
export function getAuthHeaders(): Record<string, string> {
  // Use Cognito token for all services
  const idToken = localStorage.getItem('idToken');
  if (idToken) {
    return {
      'Authorization': `Bearer ${idToken}`
    };
  }

  return {};
}

/**
 * Merge auth headers with existing headers
 * Auth headers take precedence
 */
export function mergeAuthHeaders(existingHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    ...existingHeaders,
    ...getAuthHeaders()
  };
}