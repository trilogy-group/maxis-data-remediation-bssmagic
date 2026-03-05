# BSS Magic App Template

A simplified React application template with AWS Cognito authentication and a modular component structure.

## 🏗️ Architecture Overview

### Core Structure
```
src/
├── App.tsx                    # Main application component
├── components/
│   ├── Auth/                  # Authentication components
│   │   └── AuthWrapper.tsx    # Cognito authentication wrapper
│   └── Example/               # Example tab component
│       ├── ExampleTab.tsx     # Example content component
│       └── index.ts           # Barrel export
├── stores/
│   └── authStore.ts           # Authentication state management
├── services/
│   └── bssMagicApi/          # API client configuration
└── assets/                    # Images and static assets
```

### Authentication Flow
The app uses AWS Cognito for authentication:
- `AuthWrapper` component wraps the entire application
- Handles login/logout automatically
- User info stored in `authStore` (Zustand store)
- Protected routes - users must authenticate before accessing the app

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- AWS Cognito User Pool configured

### Installation
```bash
npm install
# or
yarn install
```

### Configuration
1. Set up your AWS Cognito credentials in the appropriate config file
2. Configure the API endpoints in `services/bssMagicApi/client.ts`

### Running the App
```bash
npm run dev
# or
yarn dev
```

## 📦 Adding New Components/Tabs

### Step 1: Create Component Folder
Create a new folder in `src/components/` with your component name:

```bash
src/components/YourFeature/
├── YourFeature.tsx    # Main component
└── index.ts           # Barrel export
```

### Step 2: Create the Component

**src/components/YourFeature/YourFeature.tsx:**
```tsx
import React from 'react';

const YourFeature: React.FC = () => {
  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Your Feature Title</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Feature Content</h2>
          <p className="text-gray-600 mb-4">
            Your feature description and content here.
          </p>
          {/* Add your feature implementation */}
        </div>
      </div>
    </div>
  );
};

export default YourFeature;
```

**src/components/YourFeature/index.ts:**
```tsx
export { default as YourFeature } from './YourFeature';
```

### Step 3: Wire Up in App.tsx

#### 3.1 Import the Component
Add the import at the top of `App.tsx`:
```tsx
import { YourFeature } from './components/YourFeature';
```

#### 3.2 Add Icon Import (optional)
Import an icon from lucide-react for the sidebar:
```tsx
import { Home, Settings, /* your icon */ } from 'lucide-react';
```

#### 3.3 Update State Type
Update the `currentTab` state to include your new tab:
```tsx
const [currentTab, setCurrentTab] = useState<'home' | 'yourfeature'>('home');
```

#### 3.4 Update Render Function
Add your component to the `renderContent` function:
```tsx
const renderContent = () => {
  switch (currentTab) {
    case 'home':
      return <ExampleTab />;
    case 'yourfeature':
      return <YourFeature />;
    default:
      return <ExampleTab />;
  }
};
```

### Step 4: Add to Sidebar Navigation

Add a new button in the navigation section of `App.tsx` (after the existing Home button):

```tsx
{/* Navigation Items */}
<nav className="flex-1 p-1">
  {/* Home Button */}
  <button
    onClick={() => setCurrentTab('home')}
    className={`w-full flex items-center px-2 py-2 mb-1 rounded-md text-xs font-medium transition-colors duration-150 ${
      currentTab === 'home'
        ? 'bg-navigation-600 text-white shadow-sm'
        : 'text-navigation-200 hover:text-white hover:bg-navigation-700'
    } ${sidebarExpanded ? 'space-x-2' : 'justify-center'}`}
    title={!sidebarExpanded ? 'Home' : undefined}
  >
    <Home size={16} className="flex-shrink-0" />
    {sidebarExpanded && (
      <span className="truncate transition-opacity duration-150">
        Home
      </span>
    )}
  </button>

  {/* Your New Feature Button */}
  <button
    onClick={() => setCurrentTab('yourfeature')}
    className={`w-full flex items-center px-2 py-2 mb-1 rounded-md text-xs font-medium transition-colors duration-150 ${
      currentTab === 'yourfeature'
        ? 'bg-navigation-600 text-white shadow-sm'
        : 'text-navigation-200 hover:text-white hover:bg-navigation-700'
    } ${sidebarExpanded ? 'space-x-2' : 'justify-center'}`}
    title={!sidebarExpanded ? 'Your Feature' : undefined}
  >
    <Settings size={16} className="flex-shrink-0" />
    {sidebarExpanded && (
      <span className="truncate transition-opacity duration-150">
        Your Feature
      </span>
    )}
  </button>
</nav>
```

## 🎨 Styling Guidelines

The app uses Tailwind CSS with custom theme colors:
- **Background**: `bg-background` - Main app background
- **Navigation**: `bg-navigation` - Sidebar background
- **White/Cards**: `bg-white` - Content cards
- **Shadows**: `shadow`, `shadow-lg` - Depth indication
- **Text Colors**: 
  - `text-text-primary` - Main text
  - `text-text-secondary` - Secondary text
  - `text-text-tertiary` - Least important text

## 🔧 Key Features

### Collapsible Sidebar
- Click the chevron icon to expand/collapse
- Icons remain visible when collapsed
- Tooltips show on hover when collapsed

### User Dropdown
- Shows user info and tenant name
- Logout functionality
- Accessible from the top-right corner

### Responsive Layout
- Flexbox-based responsive design
- Scrollable content areas
- Full-height application layout

## 📝 Example: Adding a Settings Tab

Here's a complete example of adding a Settings tab:

1. **Create Component Structure:**
```bash
src/components/Settings/
├── Settings.tsx
└── index.ts
```

2. **Settings.tsx:**
```tsx
import React from 'react';

const Settings: React.FC = () => {
  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Application Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                API Endpoint
              </label>
              <input 
                type="text" 
                className="w-full p-2 border rounded" 
                placeholder="https://api.example.com"
              />
            </div>
            {/* Add more settings */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
```

3. **Update App.tsx:**
- Import: `import { Settings } from './components/Settings';`
- Import Settings icon: `import { Home, Settings as SettingsIcon } from 'lucide-react';`
- Update state: `const [currentTab, setCurrentTab] = useState<'home' | 'settings'>('home');`
- Add to renderContent:
  ```tsx
  case 'settings':
    return <Settings />;
  ```
- Add navigation button with `SettingsIcon`

## 🔐 Authentication Details

### AuthWrapper Component
- Wraps the entire app in `AppWithAuth`
- Manages Cognito authentication state
- Redirects to login if not authenticated

### useAuthStore Hook
Provides access to:
- `user` - Current user object
- `logout()` - Logout function
- `isAuthenticated` - Auth status

### Protected Components
All components inside the app are automatically protected by the AuthWrapper.

## 🛠️ Development Tips

1. **Component Organization**: Keep each feature in its own folder under `components/`
2. **Barrel Exports**: Use index.ts files for cleaner imports
3. **Type Safety**: Define proper TypeScript types for your components
4. **Consistent Styling**: Follow the existing Tailwind class patterns
5. **State Management**: For complex state, consider adding Zustand stores

## 📚 Resources

- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [AWS Cognito](https://aws.amazon.com/cognito/)
- [Lucide Icons](https://lucide.dev/icons/)
- [Zustand State Management](https://github.com/pmndrs/zustand)

## 🤝 Contributing

1. Create your feature branch
2. Follow the component structure guidelines
3. Test authentication flow
4. Submit a pull request

## 📄 License

[Your License Here]