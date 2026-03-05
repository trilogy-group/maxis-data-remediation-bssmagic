# Integration Guide

This guide shows how to integrate the Speedrun Builder Demo into the main BSS Magic App.

## Option 1: As a New Tab (Recommended)

### Step 1: Update Module Type

In `App.tsx`, add the new module ID to the type definition:

```tsx
// Line 22 - Add 'speedrun-demo' to the module type
type ModuleId =
  | 'executive'
  | 'health-trends'
  | 'oe-patcher'
  | 'oe-checker'
  | 'solution-empty'
  | 'order-not-gen'
  | 'iot-qbs'
  | 'remediation-history'
  | 'speedrun-demo';  // <- ADD THIS
```

### Step 2: Import the Component

At the top of `App.tsx`, add the import:

```tsx
import SpeedrunBuilderDemo from './components/speedrun-builder-demo/SpeedrunBuilderDemo';
```

### Step 3: Add to renderContent Switch

In the `renderContent()` function (around line 62), add a new case:

```tsx
const renderContent = () => {
  switch (currentTab) {
    case 'executive':
      return <ExecutiveDashboard />;
    case 'health-trends':
      return <HealthTrendsDashboard onNavigateToModule={(moduleId) => setCurrentTab(moduleId as ModuleId)} />;
    // ... other cases ...
    case 'speedrun-demo':
      return <SpeedrunBuilderDemo />;  // <- ADD THIS
    default:
      return <ExecutiveDashboard />;
  }
};
```

### Step 4: Add Navigation Button

In the sidebar navigation section (around line 120-200), add a new navigation item:

```tsx
{/* Speedrun Builder Demo - Add this before closing sidebar */}
<button
  onClick={() => setCurrentTab('speedrun-demo')}
  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
    currentTab === 'speedrun-demo'
      ? 'bg-primary text-white'
      : 'text-text-secondary hover:bg-background-elevated hover:text-text-primary'
  }`}
>
  <Package size={20} />
  {sidebarExpanded && <span>Speedrun Demo</span>}
</button>
```

### Step 5: Test

```bash
npm run dev
```

Click the new "Speedrun Demo" button in the sidebar.

## Option 2: Standalone Page (Alternative)

If you prefer a standalone page without the main app chrome:

### Create a Demo Route

Create `src/pages/SpeedrunDemoPage.tsx`:

```tsx
import React from 'react';
import SpeedrunBuilderDemo from '../components/speedrun-builder-demo/SpeedrunBuilderDemo';

const SpeedrunDemoPage: React.FC = () => {
  return <SpeedrunBuilderDemo />;
};

export default SpeedrunDemoPage;
```

### Access via Direct URL

If you're using React Router, add a route:

```tsx
<Route path="/speedrun-demo" element={<SpeedrunDemoPage />} />
```

Then access at: `http://localhost:3000/speedrun-demo`

## Option 3: Dev Mode Toggle

Add the demo only in development mode:

```tsx
// In App.tsx
const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

// In sidebar navigation
{DEV_MODE && (
  <button
    onClick={() => setCurrentTab('speedrun-demo')}
    className="..."
  >
    <Package size={20} />
    {sidebarExpanded && <span>Speedrun Demo (Dev)</span>}
  </button>
)}
```

## Usage After Integration

### Navigation

1. **Mouse**: Click the "Speedrun Demo" tab in the sidebar
2. **Keyboard**: Use arrow keys (←/→) to navigate between scenes
3. **Scene Dots**: Click dots in top-right to jump to specific scenes

### Scene Flow

1. **Scene 1**: Empty builder canvas
2. **Scene 2**: Populated builder with components
3. **Scene 3**: Configuration and settings
4. **Scene 4**: Live preview of runtime dashboard

### Demo Features

- Smooth transitions (300ms with Framer Motion)
- Keyboard navigation
- Visual scene indicators
- Back navigation from preview to builder
- Sample data in Scene 4 showing realistic dashboard

## Troubleshooting

### Build Errors

If you see TypeScript errors:

```bash
npm run build
```

Check that all imports are correct and types match.

### Navigation Not Working

Ensure the `currentTab` state and `setCurrentTab` function are properly wired.

### Scene Not Displaying

Check that the component is properly exported from the index file:

```tsx
import SpeedrunBuilderDemo from './components/speedrun-builder-demo';
```

### Styles Not Applying

Ensure Tailwind CSS is properly configured and the design tokens exist in `tailwind.config.js`.

## Customization

### Change Initial Scene

Edit `DemoController.tsx`:

```tsx
const [currentScene, setCurrentScene] = useState<SceneNumber>(1); // Change to 2, 3, or 4
```

### Hide Development UI

Remove or comment out the scene indicators and helper text in `DemoController.tsx`:

```tsx
{/* Scene Navigation Indicator - Remove this block */}
<div className="absolute top-4 right-4 z-50">
  {/* ... */}
</div>

{/* Keyboard Navigation Helper - Remove this block */}
<div className="absolute bottom-4 left-1/2">
  {/* ... */}
</div>
```

### Customize Transitions

Edit the transition config in each Scene component:

```tsx
transition={{ duration: 0.5, ease: 'easeInOut' }}
```

## Next Steps

1. Implement actual builder UI in Scenes 1-3
2. Add second use case (PartialDataMissing 1867)
3. Polish animations and interactions
4. Add demo rehearsal mode with auto-play
5. Record demo video for presentations

## Support

For questions or issues, refer to:
- `/docs/bss-magic-app-template/src/components/speedrun-builder-demo/README.md`
- Main project documentation in `/docs/CLAUDE.md`
