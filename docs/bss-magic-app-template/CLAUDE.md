# CLAUDE.md

This file provides guidance to Claude (claude.ai) when working with code in this repository.

## Project Overview

This is **BSS Magic App Template** - A simplified React application template with AWS Cognito authentication and a modular component structure. It provides a clean starting point for building business applications with proper authentication and a well-organized codebase.

## Development Commands

### Core Development
- `npm run dev` - Start development server (runs on port 3000, opens browser automatically)
- `npm run build` - Build production bundle (TypeScript compilation + Vite build)
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint for TypeScript/React code

### Testing
- `npm test` - Run tests (if configured)

## Architecture

### Application Structure
The app uses a **simple state management** pattern with React hooks:

- **App.tsx** - Main application component with simplified state management
- **Component Structure** - Feature-based organization in `src/components/`
  - Each feature is a self-contained folder
  - Components are organized by functionality, not technical layers
  - Example: `Example/` folder contains the example tab component

### Authentication Architecture
- **AuthWrapper** - Wraps the entire application for Cognito authentication
- **authStore** - Zustand store for authentication state
- **Protected by Default** - All components require authentication

## Development Guidelines

### AI-First Architecture Pattern

**MANDATORY**: Use the AI-comprehension optimized structure for all new features:

#### **Feature-Complete Module Pattern**
Organize code by feature, not technical concerns. Each feature is a self-contained module:

```
FeatureName/
├── FeatureName.tsx              # Main component
├── SubComponent1.tsx            # Related components  
├── SubComponent2.tsx            # Related components
├── types.ts                     # All feature types & interfaces
├── utils.ts                     # Feature utilities & helpers
├── constants.ts                 # Feature constants
└── index.ts                     # Clean exports with barrel pattern
```

#### **AI-Optimized Benefits**
- **Feature Cohesion**: All related code co-located for complete context understanding
- **Self-Contained**: AI can understand entire feature by reading one folder
- **Clean Boundaries**: Clear separation prevents architectural confusion
- **Predictable Structure**: Consistent pattern across all features
- **Import Clarity**: Single import point with documented exports

#### **Example Implementation**
```typescript
// src/components/Settings/index.ts
export { default as Settings } from './Settings';
export type { SettingsConfig, UserPreferences } from './types';
export { validateSettings, saveSettings } from './utils';
```

### Documentation First Approach

**CRITICAL**: Always maintain documentation for components and architectural decisions:

#### **Component Documentation Pattern**
Every significant component should have documentation:

```markdown
# ComponentName

## Overview
Brief description of what this component does and why it exists.

## Architecture
- Key architectural decisions
- State management approach
- External dependencies

## Usage
```tsx
import { ComponentName } from './components/ComponentName';

<ComponentName prop1="value" />
```

## Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| prop1 | string | Yes | Description of prop1 |

## State Management
Description of how state is managed in this component.

## Integration Points
- API endpoints used
- External services
- Other components it interacts with
```

#### **Documentation Requirements**
1. **Before Making Changes**: Read existing documentation
2. **After Major Changes**: Update documentation immediately
3. **Document Decisions**: Include rationale for architectural choices
4. **Keep Examples Current**: Update code examples when implementation changes
5. **Add Troubleshooting**: Document common issues and solutions

### Design System Integration

**MANDATORY: ALL UI styling must reference tailwind.config.js - NO exceptions**

**BEFORE writing ANY UI code:**
1. **Read tailwind.config.js** - Check available colors, spacing, shadows, etc.
2. **Use ONLY defined tokens** - Never hardcode colors, sizes, or styles
3. **Follow semantic naming** - Use colors based on meaning, not appearance

#### Available Color Tokens (from tailwind.config.js)

**Brand Colors:**
- `primary-*` (50-900): Purple brand colors
- `navigation-*` (50-900): Dark blue navigation
- `secondary-*` (50-900): Red accent colors

**Status Colors:**
- `success-*` (50-900): Green success states
- `warning-*` (50-900): Yellow/orange warning states
- `error-*` (50-900): Red error states

**Semantic Colors:**
- `background` / `background-paper` / `background-elevated`: White backgrounds
- `text-primary` / `text-secondary` / `text-tertiary` / `text-disabled`: Text hierarchy
- `border` / `border-strong` / `border-interactive`: Border colors
- `interactive-primary` / `interactive-secondary` / `interactive-accent` / `interactive-muted`: Interactive states

**Neutral Scale:**
- `neutral-*` (50-900): Grayscale colors for backgrounds and text

#### Color Usage Rules

**✅ CORRECT Examples:**
```tsx
// Use semantic color names
className="bg-primary text-white"
className="text-success-600 bg-success-50"
className="border-border hover:border-border-strong"
className="bg-background-paper text-text-primary"

// Use status colors for states
className="text-error-600 bg-error-50"  // Error states
className="text-success-600 bg-success-50"  // Success states
className="text-warning-600 bg-warning-50"  // Warning states
```

**❌ FORBIDDEN Examples:**
```tsx
// Never use hardcoded colors
className="bg-blue-600 text-blue-50"  // NO - blue not in config
className="text-red-500 bg-red-100"   // NO - use error-* instead
className="border-gray-200"           // NO - use border or neutral-*
```

## Key Technical Patterns

### Component Organization Pattern
```typescript
// Standard component structure
const MyComponent: React.FC<MyComponentProps> = ({ prop1, prop2 }) => {
  // 1. Hooks first
  const [state, setState] = useState(initialValue);
  const { user } = useAuthStore();
  
  // 2. Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies]);
  
  // 3. Handlers
  const handleClick = () => {
    // Handler logic
  };
  
  // 4. Render helpers
  const renderContent = () => {
    return <div>Content</div>;
  };
  
  // 5. Main render
  return (
    <div className="container">
      {renderContent()}
    </div>
  );
};

export default MyComponent;
```

### State Management Guidelines
- **Local State**: Use `useState` for component-specific state
- **Global Auth**: Use `authStore` for authentication state
- **Form State**: Consider using controlled components with local state
- **Complex State**: Create dedicated Zustand stores when needed

### Zustand Store Pattern (When Needed)
```typescript
// Standard store structure
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface StoreState {
  // State
  items: Item[];
  selectedId: string | null;
  
  // Actions
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
  setSelectedId: (id: string | null) => void;
}

export const useFeatureStore = create<StoreState>()(
  devtools(
    (set) => ({
      // Initial state
      items: [],
      selectedId: null,
      
      // Actions
      addItem: (item) => set((state) => ({ 
        items: [...state.items, item] 
      })),
      removeItem: (id) => set((state) => ({ 
        items: state.items.filter(i => i.id !== id) 
      })),
      setSelectedId: (id) => set({ selectedId: id }),
    }),
    {
      name: 'feature-store'
    }
  )
);
```

## Technology Stack
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom design system
- **Icons**: Lucide React
- **State Management**: React hooks + Zustand (when needed)
- **Authentication**: AWS Cognito with AuthWrapper

## Development Workflow

### Adding New Features

1. **Create Component Structure**
   ```bash
   src/components/YourFeature/
   ├── YourFeature.tsx
   ├── types.ts (if needed)
   ├── utils.ts (if needed)
   └── index.ts
   ```

2. **Implement Component**
   - Follow the AI-First module pattern
   - Use only design tokens from tailwind.config.js
   - Include proper TypeScript types

3. **Wire in App.tsx**
   - Import component
   - Add to state type
   - Add to render function
   - Add navigation button

4. **Document**
   - Update README.md with new feature
   - Add inline comments for complex logic
   - Document any new patterns introduced

### Code Review Checklist

Before committing code, ensure:
- [ ] All colors use design tokens from tailwind.config.js
- [ ] Component follows modular structure pattern
- [ ] TypeScript types are properly defined
- [ ] No hardcoded values (colors, sizes, strings)
- [ ] Documentation is updated
- [ ] Barrel exports are used for clean imports
- [ ] Authentication is properly handled

## Common Patterns

### Protected Routes
All components are automatically protected by AuthWrapper. No additional route protection needed.

### API Calls
```typescript
const fetchData = async () => {
  try {
    const apiClient = getBSSMagicApiClient();
    const response = await fetch(`${apiClient.getBaseUrl()}/api/endpoint`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('idToken')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error('API call failed');
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
};
```

### Form Handling
```typescript
const [formData, setFormData] = useState({
  field1: '',
  field2: ''
});

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  // Process form data
};

const handleChange = (field: keyof typeof formData) => 
  (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };
```

## UI/UX Guidelines

### General Principles
- **Consistency**: Use the same patterns throughout the app
- **Clarity**: Make UI intentions clear with proper labeling
- **Feedback**: Provide immediate feedback for user actions
- **Accessibility**: Include proper ARIA labels and keyboard navigation

### Component Spacing
- Use consistent spacing from Tailwind config
- Standard padding: `p-4` or `p-6` for containers
- Standard margins: `mb-4` between sections
- Button groups: `space-x-2` between buttons

### Interactive Elements
- All buttons should have hover states
- Include focus rings for keyboard navigation
- Use loading states for async operations
- Provide clear error messages

## Configuration Files

- **vite.config.ts** - Vite configuration with React plugin
- **tsconfig.json** - TypeScript configuration
- **tailwind.config.js** - Custom design system tokens
- **postcss.config.js** - PostCSS configuration

## Important Notes

### Authentication
- Always check user authentication state before sensitive operations
- Token refresh is handled automatically by AuthWrapper
- Logout clears all local storage and redirects to login

### Performance
- Use React.memo for expensive components
- Implement lazy loading for large components
- Optimize re-renders with proper dependency arrays

### Security
- Never store sensitive data in local storage
- Always validate user input
- Use HTTPS for all API calls
- Implement proper CORS policies

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Check Cognito configuration
   - Verify token is present and valid
   - Ensure AuthWrapper is properly configured

2. **Styling Issues**
   - Verify using design tokens from tailwind.config.js
   - Check for CSS specificity conflicts
   - Ensure Tailwind classes are properly applied

3. **State Management**
   - Check component re-render logic
   - Verify state updates are immutable
   - Ensure proper cleanup in useEffect

## Best Practices Summary

1. **Always use the modular component pattern**
2. **Document as you code, not after**
3. **Use design tokens exclusively - no hardcoded values**
4. **Keep components focused and single-purpose**
5. **Write TypeScript types for all props and state**
6. **Test authentication flow regularly**
7. **Update documentation immediately after changes**
8. **Follow existing patterns unless improving them**

## Available Services

### BSS Magic API (`src/services/bssMagicApi`)

Main API client for interacting with the BSS Magic backend. Supports:
- Projects, Journeys, Workflows, Pipelines
- Apps and App Workspaces
- Dashboards
- Decision Traces
- User Profiles

```typescript
import { getBSSMagicApiClient } from './services/bssMagicApi';

const client = getBSSMagicApiClient();
const projects = await client.listProjects();
const apps = await client.listApps();
```

### Ontology API (`src/services/ontology`)

Client for querying ontology data - entities, records, and knowledge base information:

```typescript
import { getOntologyApiClient, dataQueryService, knowledgeBaseService } from './services/ontology';

// List entity records
const client = getOntologyApiClient();
const records = await client.listEntityRecords('api-name', 'EntityName', { limit: 100 });

// Execute data queries
const results = await dataQueryService.executeQuery({
  connection_id: 'connection-id',
  database: 'database',
  primary_table: 'TableName',
  select_fields: ['*'],
  limit: 100
});
```

### AI Block Service (`src/services/aiBlock`)

Service for AI-powered analysis and chat:

```typescript
import { getAiBlockService } from './services/aiBlock';

const aiService = getAiBlockService();

// Simple chat completion
const response = await aiService.chat('What is the status?', systemPrompt);

// Structured analysis with MCP tools
const analysis = await aiService.analyze(
  'Analyze the data',
  systemPrompt,
  { enableMcp: true }
);
```

## Authentication Modes

### Standard Mode (AuthWrapper)

For standalone applications:

```tsx
import { AuthWrapper } from './components/Auth/AuthWrapper';

<AuthWrapper>
  <App />
</AuthWrapper>
```

### Iframe Mode (IframeAuthWrapper)

For apps embedded in BSS Magic parent application:

```tsx
import { IframeAuthWrapper } from './components/Auth/IframeAuthWrapper';

<IframeAuthWrapper>
  <App />
</IframeAuthWrapper>
```

Control behavior with `VITE_SHOW_LOGIN`:
- `VITE_SHOW_LOGIN=false` (default): Wait for auth tokens via postMessage from parent
- `VITE_SHOW_LOGIN=true`: Show login form if no tokens (standalone mode)

Expected postMessage format from parent:
```javascript
{
  type: 'BSS_MAGIC_AUTH',
  payload: {
    accessToken: string,
    refreshToken: string,
    idToken: string
  }
}
```

## Environment Variables

Required environment variables (create `.env` from `.env.example`):

```env
# Core API
VITE_BSS_MAGIC_API_URL=https://adapters.bss-magic.totogi.solutions

# Ontology API (optional, defaults to BSS Magic API URL)
VITE_ONTOLOGY_API_URL=https://adapters.bss-magic.totogi.solutions

# AI Service (optional)
VITE_AI_FDE_API_URL=https://adapter.bss-magic.totogi.solutions

# AWS Cognito
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=your-user-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id

# Auth behavior
VITE_SHOW_LOGIN=true  # Set to false for iframe mode

# Optional: Google Maps
VITE_GOOGLE_MAPS_API_KEY=your-api-key
```

## State Management Stores

### authStore
Authentication state with Cognito integration:
- `login`, `logout`, `checkAuth`
- `setAuthFromIframe` for iframe mode
- User info and loading states

### featureFlags
Simple feature flag management:
```typescript
import { useFeatureFlags } from './stores/featureFlags';

const { flags, toggleFlag, setFlag } = useFeatureFlags();
```

### ontologyStore
Generic store for ontology entity data:
```typescript
import { useOntologyStore } from './stores/ontologyStore';

const { loadEntityRecords, getEntityRecords, isEntityLoading } = useOntologyStore();

// Load data
await loadEntityRecords('api-name', 'EntityName');

// Get loaded data
const records = getEntityRecords('api-name', 'EntityName');
```