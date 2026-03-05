import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  GetUserCommand,
  AuthFlowType,
  ChallengeNameType,
  AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';

// Cognito configuration - using same pool as admin portal
const COGNITO_CONFIG = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
};

// Validate configuration
if (!COGNITO_CONFIG.clientId) {
  console.warn('⚠️ Cognito Client ID not configured. Please set VITE_COGNITO_CLIENT_ID in your .env file');
}

// Create Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: COGNITO_CONFIG.region,
});

export interface CognitoAuthResult {
  success: boolean;
  challengeName?: ChallengeNameType;
  session?: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role?: string;
    organizationId?: string;
    tenantIds?: string[];
  };
  error?: string;
}

export interface CognitoUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  organizationId?: string;
  tenantIds?: string[];
}

class CognitoService {
  /**
   * Parse user attributes from Cognito response
   */
  private parseUserAttributes(attributes: AttributeType[]): CognitoUser {
    const user: CognitoUser = {
      id: '',
      name: '',
      email: '',
    };

    attributes.forEach((attr) => {
      switch (attr.Name) {
        case 'sub':
          user.id = attr.Value || '';
          break;
        case 'email':
          user.email = attr.Value || '';
          break;
        case 'name':
          user.name = attr.Value || '';
          break;
        case 'custom:role':
          user.role = attr.Value || 'user';
          break;
        case 'custom:organization_id':
          user.organizationId = attr.Value || '';
          break;
        case 'custom:tenant_ids':
          // Parse tenant IDs from JSON string
          try {
            user.tenantIds = attr.Value ? JSON.parse(attr.Value) : [];
          } catch {
            user.tenantIds = [];
          }
          break;
      }
    });

    // Fallback for name if not provided
    if (!user.name && user.email) {
      user.name = user.email.split('@')[0];
    }

    return user;
  }

  /**
   * Get user details from access token
   */
  private async getUserDetails(accessToken: string): Promise<CognitoUser> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await cognitoClient.send(command);

      if (!response.UserAttributes) {
        throw new Error('No user attributes received');
      }

      return this.parseUserAttributes(response.UserAttributes);
    } catch (error) {
      console.error('❌ Failed to get user details:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with email and password
   */
  async login(email: string, password: string): Promise<CognitoAuthResult> {
    try {
      console.log(`🔐 CognitoService: Attempting login for ${email}`);

      if (!COGNITO_CONFIG.clientId) {
        return {
          success: false,
          error: 'Cognito is not configured. Please contact your administrator.',
        };
      }

      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: COGNITO_CONFIG.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const response = await cognitoClient.send(command);
      console.log('🔐 Cognito login response:', {
        challengeName: response.ChallengeName,
        hasSession: !!response.Session,
        hasTokens: !!response.AuthenticationResult,
      });

      // Handle successful authentication
      if (response.AuthenticationResult) {
        const { AccessToken, RefreshToken, IdToken } = response.AuthenticationResult;

        if (!AccessToken) {
          return {
            success: false,
            error: 'No access token received from Cognito',
          };
        }

        // Get user details
        const user = await this.getUserDetails(AccessToken);

        return {
          success: true,
          accessToken: AccessToken,
          refreshToken: RefreshToken,
          idToken: IdToken,
          user,
        };
      }

      // Handle challenges (like NEW_PASSWORD_REQUIRED)
      if (response.ChallengeName) {
        console.log(`🔐 Challenge required: ${response.ChallengeName}`);
        return {
          success: false,
          challengeName: response.ChallengeName,
          session: response.Session,
        };
      }

      return {
        success: false,
        error: 'Unexpected response from Cognito',
      };
    } catch (error: any) {
      console.error('❌ Cognito login error:', error);

      // Handle specific Cognito errors
      let errorMessage = 'Login failed';
      if (error.name === 'NotAuthorizedException') {
        errorMessage = 'Invalid email or password';
      } else if (error.name === 'UserNotFoundException') {
        errorMessage = 'User not found';
      } else if (error.name === 'UserNotConfirmedException') {
        errorMessage = 'User account is not confirmed';
      } else if (error.name === 'NetworkError') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle force password change challenge
   */
  async changePassword(
    email: string,
    newPassword: string,
    session: string
  ): Promise<CognitoAuthResult> {
    try {
      console.log(`🔐 CognitoService: Changing password for ${email}`);

      if (!COGNITO_CONFIG.clientId) {
        return {
          success: false,
          error: 'Cognito is not configured. Please contact your administrator.',
        };
      }

      const command = new RespondToAuthChallengeCommand({
        ClientId: COGNITO_CONFIG.clientId,
        ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: newPassword,
        },
      });

      const response = await cognitoClient.send(command);
      console.log('🔐 Password change response:', {
        hasTokens: !!response.AuthenticationResult,
        challengeName: response.ChallengeName,
      });

      if (response.AuthenticationResult) {
        const { AccessToken, RefreshToken, IdToken } = response.AuthenticationResult;

        if (!AccessToken) {
          return {
            success: false,
            error: 'No access token received after password change',
          };
        }

        // Get user details
        const user = await this.getUserDetails(AccessToken);

        return {
          success: true,
          accessToken: AccessToken,
          refreshToken: RefreshToken,
          idToken: IdToken,
          user,
        };
      }

      return {
        success: false,
        error: 'Password change failed',
      };
    } catch (error: any) {
      console.error('❌ Password change error:', error);

      let errorMessage = 'Password change failed';
      if (error.name === 'InvalidPasswordException') {
        errorMessage = 'Password does not meet security requirements';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Verify if a token is still valid
   */
  async verifyToken(accessToken: string): Promise<boolean> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      await cognitoClient.send(command);
      return true;
    } catch (error) {
      console.error('❌ Token verification failed:', error);
      return false;
    }
  }

  /**
   * Sign out user (client-side only, tokens should be cleared)
   */
  signOut(): void {
    // Cognito doesn't require server-side logout for client credentials flow
    // Just clear local tokens
    console.log('🔐 CognitoService: User signed out');
  }
}

// Export singleton instance
export const cognitoService = new CognitoService();