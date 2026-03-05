import React, { useState } from 'react';
import { BarChart3, Wrench, Package, AlertTriangle, Plug, FileText, ChevronRight, ChevronLeft, LogOut, User, ChevronDown, Building2, Activity, Search } from 'lucide-react';
import logoImage from './assets/img/Logo-BSS-Magic-2025.png';
import totogiLogoImage from './assets/img/SVG/white-red-totogi-logo.svg';
import { useAuthStore } from './stores/authStore';
import { AuthWrapper } from './components/Auth/AuthWrapper';
import { DevAuthWrapper } from './components/Auth/DevAuthWrapper';
import { getBSSMagicApiClient } from './services/bssMagicApi/client';
import { ExecutiveDashboard } from './components/Dashboard/ExecutiveDashboard';
import { OEPatcherModule } from './components/Modules/OEPatcherModule';
import { OECheckerModule } from './components/Modules/OECheckerModule';
import { SolutionEmptyModule } from './components/Modules/SolutionEmptyModule';
import { OrderNotGeneratedModule } from './components/Modules/OrderNotGeneratedModule';
import { IoTQBSModule } from './components/Modules/IoTQBSModule';
import { ServiceProblemsModule } from './components/Modules/ServiceProblemsModule';
import { HealthTrendsDashboard } from './components/HealthDashboard';

// Check if dev mode is enabled
const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

// Module type definition
type ModuleId = 'executive' | 'health-trends' | 'oe-patcher' | 'oe-checker' | 'solution-empty' | 'order-not-gen' | 'iot-qbs' | 'remediation-history';

// App Component
const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<ModuleId>('health-trends');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [tenantName, setTenantName] = useState<string>('');

  // Get auth store for user info and logout
  const { user, logout } = useAuthStore();

  // Fetch tenant name when user is available
  React.useEffect(() => {
    if (user) {
      const fetchTenantName = async () => {
        try {
          const apiClient = getBSSMagicApiClient();
          const response = await fetch(`${apiClient.getBaseUrl()}/bss-magic-api/api/v1/users/profile`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('idToken')}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            setTenantName(data.tenant_name || 'BSS Magic');
          }
        } catch (error) {
          console.error('Error fetching tenant name:', error);
          setTenantName('BSS Magic');
        }
      };

      fetchTenantName();
    }
  }, [user]);

  const renderContent = () => {
    switch (currentTab) {
      case 'executive':
        return <ExecutiveDashboard />;
      case 'health-trends':
        return <HealthTrendsDashboard onNavigateToModule={(moduleId) => setCurrentTab(moduleId as ModuleId)} />;
      case 'oe-patcher':
        return <OEPatcherModule />;
      case 'oe-checker':
        return <OECheckerModule />;
      case 'solution-empty':
        return <SolutionEmptyModule />;
      case 'order-not-gen':
        return <OrderNotGeneratedModule />;
      case 'iot-qbs':
        return <IoTQBSModule />;
      case 'remediation-history':
        return <ServiceProblemsModule />;
      default:
        return <ExecutiveDashboard />;
    }
  };

  // Click outside handler for dropdown
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownOpen) {
        const target = e.target as HTMLElement;
        if (!target.closest('.user-dropdown-container')) {
          setUserDropdownOpen(false);
        }
      }
    };

    if (userDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [userDropdownOpen]);

  return (
    <div className="h-screen flex flex-col bg-background">
        {/* Top Navigation Header - Full Width */}
        <header className="bg-navigation border-b border-navigation-800 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-3">
                <img 
                  src={totogiLogoImage} 
                  alt="Totogi Logo" 
                  className="h-auto w-20"
                />
                <h1 className="text-xl font-bold text-white">
                  BSS Magic
                </h1>
                <img 
                  src={logoImage} 
                  alt="BSS Magic Logo" 
                  className="h-6 w-6"
                />
              </div>
              <span className="text-xs text-navigation-100 bg-navigation-800 px-2 py-1 rounded">
                Maxis Dashboard - TMF API Integration
              </span>
            </div>
            <div className="flex items-center space-x-3">
              {user && (
                <div className="relative user-dropdown-container">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center space-x-2 text-navigation-200 hover:text-white transition-colors px-3 py-1.5 rounded hover:bg-navigation-700"
                  >
                    <Building2 size={16} />
                    <span className="text-sm font-medium">{tenantName || 'Loading...'}</span>
                    <ChevronDown size={14} className={`transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* User Dropdown Menu */}
                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-border py-1 z-50">
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <User size={20} className="text-text-secondary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-text-primary truncate">{user.name}</div>
                            <div className="text-xs text-text-secondary truncate">{user.email}</div>
                            <div className="text-xs text-text-tertiary capitalize mt-0.5">Role: {user.role}</div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          logout();
                          setUserDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-neutral-50 transition-colors flex items-center space-x-2"
                      >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Area with Sidebar */}
        <div className="flex-1 flex min-h-0">
          {/* Left Sidebar */}
          <div className={`bg-navigation flex flex-col transition-[width] duration-200 ease-out ${
            sidebarExpanded ? 'w-64' : 'w-14'
          }`}>
            {/* Sidebar Toggle */}
            <div className="px-2 py-2 border-b border-navigation-700">
              {sidebarExpanded ? (
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-medium text-navigation-100">Modules</span>
                  <button
                    onClick={() => setSidebarExpanded(false)}
                    className="text-navigation-200 hover:text-white transition-colors p-1 rounded hover:bg-navigation-700"
                    title="Collapse sidebar"
                  >
                    <ChevronLeft size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSidebarExpanded(true)}
                  className="text-navigation-200 hover:text-white transition-colors mx-auto block p-1 rounded hover:bg-navigation-700"
                  title="Expand sidebar"
                >
                  <ChevronRight size={16} />
                </button>
              )}
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 p-1">
              <button
                onClick={() => setCurrentTab('executive')}
                className={`w-full flex items-center px-2 py-2 mb-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                  currentTab === 'executive'
                    ? 'bg-navigation-600 text-white shadow-sm'
                    : 'text-navigation-200 hover:text-white hover:bg-navigation-700'
                } ${sidebarExpanded ? 'space-x-2' : 'justify-center'}`}
                title={!sidebarExpanded ? 'Executive Overview' : undefined}
              >
                <BarChart3 size={16} className="flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="truncate transition-opacity duration-150">
                    Executive Overview
                  </span>
                )}
              </button>

              {/* Health Trends Dashboard */}
              <button
                onClick={() => setCurrentTab('health-trends')}
                className={`w-full flex items-center px-2 py-2 mb-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                  currentTab === 'health-trends'
                    ? 'bg-navigation-600 text-white shadow-sm'
                    : 'text-navigation-200 hover:text-white hover:bg-navigation-700'
                } ${sidebarExpanded ? 'space-x-2' : 'justify-center'}`}
                title={!sidebarExpanded ? 'Health Trends' : undefined}
              >
                <Activity size={16} className="flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="truncate transition-opacity duration-150">
                    Health Trends
                  </span>
                )}
              </button>
              
              {/* Divider */}
              {sidebarExpanded && (
                <div className="my-2 px-2">
                  <div className="border-t border-navigation-700"></div>
                  <div className="text-[10px] text-navigation-400 mt-2 px-2">REMEDIATION MODULES</div>
                </div>
              )}
              
              {/* Migrated Service Data Patching */}
              <button
                onClick={() => setCurrentTab('oe-patcher')}
                className={`w-full flex items-center px-2 py-2 mb-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                  currentTab === 'oe-patcher'
                    ? 'bg-navigation-600 text-white shadow-sm'
                    : 'text-navigation-200 hover:text-white hover:bg-navigation-700'
                } ${sidebarExpanded ? 'space-x-2' : 'justify-center'}`}
                title={!sidebarExpanded ? 'Migrated Service Data Patching' : undefined}
              >
                <Wrench size={16} className="flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="truncate transition-opacity duration-150">
                    Migrated Service Data Patching
                  </span>
                )}
              </button>

              {/* Migrated Service Checker */}
              <button
                onClick={() => setCurrentTab('oe-checker')}
                className={`w-full flex items-center px-2 py-2 mb-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                  currentTab === 'oe-checker'
                    ? 'bg-navigation-600 text-white shadow-sm'
                    : 'text-navigation-200 hover:text-white hover:bg-navigation-700'
                } ${sidebarExpanded ? 'space-x-2' : 'justify-center'}`}
                title={!sidebarExpanded ? 'Migrated Service Checker' : undefined}
              >
                <Search size={16} className="flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="truncate transition-opacity duration-150">
                    Migrated Service Checker
                  </span>
                )}
              </button>

              {/* 1147 Solution Empty */}
              <button
                onClick={() => setCurrentTab('solution-empty')}
                className={`w-full flex items-center px-2 py-2 mb-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                  currentTab === 'solution-empty'
                    ? 'bg-navigation-600 text-white shadow-sm'
                    : 'text-navigation-200 hover:text-white hover:bg-navigation-700'
                } ${sidebarExpanded ? 'space-x-2' : 'justify-center'}`}
                title={!sidebarExpanded ? '1147 Solution Empty' : undefined}
              >
                <Package size={16} className="flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="truncate transition-opacity duration-150">
                    1147 Solution Empty
                  </span>
                )}
              </button>

              {/* Order Not Generated */}
              <button
                onClick={() => setCurrentTab('order-not-gen')}
                className={`w-full flex items-center px-2 py-2 mb-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                  currentTab === 'order-not-gen'
                    ? 'bg-navigation-600 text-white shadow-sm'
                    : 'text-navigation-200 hover:text-white hover:bg-navigation-700'
                } ${sidebarExpanded ? 'space-x-2' : 'justify-center'}`}
                title={!sidebarExpanded ? 'Order Not Generated' : undefined}
              >
                <AlertTriangle size={16} className="flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="truncate transition-opacity duration-150">
                    Order Not Generated
                  </span>
                )}
              </button>

              {/* IoT QBS Remediator */}
              <button
                onClick={() => setCurrentTab('iot-qbs')}
                className={`w-full flex items-center px-2 py-2 mb-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                  currentTab === 'iot-qbs'
                    ? 'bg-navigation-600 text-white shadow-sm'
                    : 'text-navigation-200 hover:text-white hover:bg-navigation-700'
                } ${sidebarExpanded ? 'space-x-2' : 'justify-center'}`}
                title={!sidebarExpanded ? 'IoT QBS Remediator' : undefined}
              >
                <Plug size={16} className="flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="truncate transition-opacity duration-150">
                    IoT QBS Remediator
                  </span>
                )}
              </button>

              {/* Service Problems */}
              <button
                onClick={() => setCurrentTab('remediation-history')}
                className={`w-full flex items-center px-2 py-2 mb-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                  currentTab === 'remediation-history'
                    ? 'bg-navigation-600 text-white shadow-sm'
                    : 'text-navigation-200 hover:text-white hover:bg-navigation-700'
                } ${sidebarExpanded ? 'space-x-2' : 'justify-center'}`}
                title={!sidebarExpanded ? 'Service Problems' : undefined}
              >
                <FileText size={16} className="flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="truncate transition-opacity duration-150">
                    Service Problems
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-gray-50">
            <div className="p-6">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
  );
};

// Export App wrapped in appropriate AuthWrapper
const AppWithAuth: React.FC = () => {
  // Use DevAuthWrapper in dev mode, otherwise use regular AuthWrapper
  const Wrapper = DEV_MODE ? DevAuthWrapper : AuthWrapper;
  
  return (
    <Wrapper>
      <App />
    </Wrapper>
  );
};

export default AppWithAuth;