import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, Check, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import totogiLogoImage from '../../assets/img/totogi-logo-rgb.svg';
import circle1 from '../../assets/img/circle-1.svg';
import circle2 from '../../assets/img/circle-2.svg';
import rectangle1 from '../../assets/img/rectangle-1.svg';
import rectangle2 from '../../assets/img/rectangle-2.svg';
import polygon1 from '../../assets/img/polygon-1.svg';

export const ChangePasswordForm: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const { changePassword, isLoading, authChallenge } = useAuthStore();

  const email = authChallenge.username || 'Unknown User';

  // Password validation rules
  const validatePassword = (password: string) => {
    const rules = {
      minLength: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    return {
      isValid: Object.values(rules).every(Boolean),
      rules,
    };
  };

  const passwordValidation = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowErrors(true);

    if (!passwordValidation.isValid) {
      setError('Password does not meet security requirements');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    try {
      await changePassword(email, newPassword);
      // Success is handled by the store - user will be redirected automatically
    } catch (err) {
      setError((err as Error).message || 'Failed to change password');
    }
  };

  const PasswordRule: React.FC<{ isValid: boolean; children: React.ReactNode; showError?: boolean }> = ({
    isValid,
    children,
    showError = false
  }) => {
    const displayStatus = showErrors || (!newPassword && !isValid) ? true : !isValid;
    const color = showErrors
      ? (isValid ? 'text-success-600' : 'text-error-600')
      : (isValid ? 'text-success-600' : 'text-text-tertiary');

    return (
      <div className={`flex items-center gap-2 text-sm ${color}`}>
        {showErrors || isValid ? (
          isValid ? (
            <Check className="w-4 h-4 flex-shrink-0" />
          ) : (
            <X className="w-4 h-4 flex-shrink-0" />
          )
        ) : (
          <div className="w-4 h-4 flex-shrink-0" />
        )}
        <span>{children}</span>
      </div>
    );
  };

  return (
    <div className="w-screen h-screen grid grid-rows-4 grid-cols-3 md:grid-cols-5 md:grid-rows-5" style={{ backgroundColor: '#001D3D' }}>
      {/* Center content with lock icon and text */}
      <div className="row-start-1 row-span-1 col-span-3 col-start-1 md:row-start-3 md:row-span-1 md:p-0 md:col-span-3 flex items-center justify-center">
        <div className="text-white text-center px-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-6">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            Create Your Password
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-md mx-auto">
            This is your first time logging in. Please create a secure password.
          </p>
        </div>
      </div>

      {/* Animated shapes - exact positioning from Angular app */}
      {/* Circle 1 - Top left area */}
      <div className="col-start-1 row-start-1 md:col-start-2 md:col-span-1">
        <img
          src={circle1}
          className="animation-two w-16 ml-12 -mt-2 md:w-48 md:-ml-4 md:-mt-8"
          alt="circle"
        />
      </div>

      {/* Rectangle 1 - Top right */}
      <div className="col-start-3 row-start-1">
        <img
          src={rectangle1}
          className="animation-three w-32 ml-14 md:w-full md:-mt-4 md:ml-4 lg:-ml-6 xl:ml-0"
          alt="rectangle"
        />
      </div>

      {/* Circle 2 - Right middle */}
      <div className="col-start-3 row-start-1 md:row-start-2">
        <img
          src={circle2}
          className="animation-two w-28 mt-10 ml-20 md:w-full md:ml-40 md:-mt-4"
          style={{ animationDelay: '1.5s' }}
          alt="circle"
        />
      </div>

      {/* Rectangle 2 - Bottom left */}
      <div className="col-start-1 row-start-1 md:row-start-4">
        <img
          src={rectangle2}
          className="animation-four w-20 mt-28 md:w-48 md:-mt-16 md:-ml-16 lg:-ml-6 xl:ml-0"
          alt="rectangle"
        />
      </div>

      {/* Polygon 1 - Bottom middle */}
      <div className="col-start-1 row-start-1 md:row-start-4 md:col-start-2">
        <img
          src={polygon1}
          className="animation-one w-16 mt-32 ml-12 md:w-48 md:mt-24 md:-ml-52"
          alt="polygon"
        />
      </div>

      {/* Right Side - Password Change Form */}
      <div className="row-span-3 col-span-3 row-start-2 col-start-1 md:row-span-5 md:col-span-2 bg-white rounded-t-xl md:rounded-r-none md:rounded-l-xl relative flex">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 z-30 flex items-center justify-center rounded-tl-xl rounded-bl-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        )}

        <div className="relative z-10 flex flex-col p-6 md:p-8 lg:px-16 items-start justify-center w-full overflow-y-auto">
          <div className="w-full">
            {/* Logo */}
            <img
              src={totogiLogoImage}
              alt="Totogi"
              className="h-10 mb-8"
            />

            {/* Error message */}
            {error && (
              <div className="w-full mb-4">
                <div className="bg-error-50 p-3 text-error-600 rounded-md flex items-start">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 mr-2" />
                  <span className="text-xs">{error}</span>
                </div>
              </div>
            )}

            {/* Title */}
            <h1 className="text-xl md:text-2xl font-normal text-text-primary mb-1">
              Create Your Password
            </h1>
            <p className="text-sm text-text-secondary mb-1">
              You need to create your password because this is the first time you are logging in.
            </p>
            <p className="text-xs text-text-tertiary mb-5">
              Account: <span className="font-medium text-text-primary">{email}</span>
            </p>

            {/* Password Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              {/* New Password Field */}
              <div>
                <label htmlFor="newPassword" className="block text-xs font-medium text-text-secondary mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 text-sm border border-border rounded-md focus:ring-2 focus:ring-primary-200 focus:border-primary bg-background text-text-primary transition-all"
                    placeholder="Enter new password"
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors p-0.5"
                    disabled={isLoading}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password Requirements */}
              <div className="space-y-1.5 p-3 bg-neutral-50 rounded-md">
                <PasswordRule isValid={passwordValidation.rules.minLength}>
                  At least 8 characters
                </PasswordRule>
                <PasswordRule isValid={passwordValidation.rules.hasUpper}>
                  One uppercase letter
                </PasswordRule>
                <PasswordRule isValid={passwordValidation.rules.hasLower}>
                  One lowercase letter
                </PasswordRule>
                <PasswordRule isValid={passwordValidation.rules.hasNumber}>
                  One number
                </PasswordRule>
                <PasswordRule isValid={passwordValidation.rules.hasSpecial}>
                  One special character (!@#$%^&*...)
                </PasswordRule>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-medium text-text-secondary mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 text-sm border border-border rounded-md focus:ring-2 focus:ring-primary-200 focus:border-primary bg-background text-text-primary transition-all"
                    placeholder="Confirm new password"
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors p-0.5"
                    disabled={isLoading}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <div className="mt-1.5">
                    <PasswordRule isValid={passwordsMatch} showError>
                      Passwords match
                    </PasswordRule>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !passwordValidation.isValid || !passwordsMatch}
                className="w-full bg-primary text-white py-2.5 rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm tracking-wider flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    <span>Creating Password...</span>
                  </>
                ) : (
                  <span>Create Password</span>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8">
              <p className="text-[10px] text-text-tertiary text-center">
                Your new password will be used for future logins to this system.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};