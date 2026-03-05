import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { ChangePasswordForm } from './ChangePasswordForm';
import { ChallengeNameType } from '@aws-sdk/client-cognito-identity-provider';
import totogiLogoImage from '../../assets/img/totogi-logo-rgb.svg';
import circle1 from '../../assets/img/circle-1.svg';
import circle2 from '../../assets/img/circle-2.svg';
import rectangle1 from '../../assets/img/rectangle-1.svg';
import rectangle2 from '../../assets/img/rectangle-2.svg';
import polygon1 from '../../assets/img/polygon-1.svg';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, isLoading, authChallenge } = useAuthStore();

  // If password change is required, show the change password form
  if (authChallenge.type === ChallengeNameType.NEW_PASSWORD_REQUIRED) {
    return <ChangePasswordForm />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="w-screen h-screen grid grid-rows-4 grid-cols-3 md:grid-cols-5 md:grid-rows-5" style={{ backgroundColor: '#001D3D' }}>
      {/* BSS Magic Title - positioned centrally */}
      <div className="row-start-1 row-span-1 col-span-3 col-start-1 md:row-start-3 md:row-span-1 md:p-0 md:col-span-3 flex items-center justify-center">
        <h1 className="text-white text-5xl md:text-7xl font-bold">
          BSS Magic
        </h1>
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

      {/* Right Side - Login Form */}
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
              className="h-10 mb-12"
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
              Welcome to <strong className="font-semibold">BSS Magic</strong>
            </h1>
            <p className="text-sm text-text-secondary mb-6">
              Sign in to access the platform
            </p>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-text-secondary mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-md focus:ring-2 focus:ring-primary-200 focus:border-primary bg-background text-text-primary transition-all"
                  placeholder="Enter your email"
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-text-secondary mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 text-sm border border-border rounded-md focus:ring-2 focus:ring-primary-200 focus:border-primary bg-background text-text-primary transition-all"
                    placeholder="Enter your password"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors p-0.5"
                    disabled={isLoading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white py-2.5 rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm tracking-wider flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Log in</span>
                )}
              </button>
            </form>

            {/* Footer Links */}
            <div className="mt-6 text-center">
              <a href="#" className="text-xs text-primary hover:text-primary-600 font-medium">
                Forgot your password?
              </a>
            </div>

            {/* Security Notice */}
            <div className="mt-8">
              <p className="text-[10px] text-text-tertiary text-center">
                This system is for authorized personnel only. All access is logged and monitored.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};