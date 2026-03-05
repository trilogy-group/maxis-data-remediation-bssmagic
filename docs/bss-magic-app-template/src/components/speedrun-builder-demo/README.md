# Speedrun Builder Demo

A multi-scene demo showcasing **two Maxis use cases** - SolutionEmpty (1147) and PartialDataMissing (1867) - demonstrating pattern reusability in the Speedrun builder. Built with React, Framer Motion, and TypeScript.

## Structure

```
speedrun-builder-demo/
├── DemoController.tsx          # Main orchestrator with module switching
├── Scene1_Empty.tsx            # Empty builder state
├── Scene2_Populated.tsx        # SolutionEmpty (1147) - 5 widgets
├── Scene3_Config.tsx           # SolutionEmpty (1147) - Configuration
├── Scene4_Preview.tsx          # SolutionEmpty (1147) - Runtime preview
├── Scene2_Populated_1867.tsx   # PartialDataMissing (1867) - 5 widgets
├── Scene3_Config_1867.tsx      # PartialDataMissing (1867) - Configuration
├── Scene4_Preview_1867.tsx     # PartialDataMissing (1867) - Runtime preview
├── BuilderLayout.tsx           # Three-panel layout component
├── WidgetCard.tsx              # Reusable widget card component
├── SpeedrunBuilderDemo.tsx    # Main export component
├── index.ts                    # Barrel exports
└── README.md                   # This file
```

## Components

### DemoController

Main orchestrator that manages scene transitions, navigation, and module switching.

**Features:**
- State management for current scene (1-4)
- **Module switcher** - Toggle between 1147 (SolutionEmpty) and 1867 (PartialDataMissing)
- Smooth transitions using Framer Motion AnimatePresence
- Keyboard navigation (arrow keys)
- Visual scene indicators (dots in top-right)
- Scene navigation methods: `nextScene`, `prevScene`, `goToScene`

**Module Switcher:**
```tsx
<button onClick={() => setCurrentModule('1147')}>
  1147: SolutionEmpty
</button>
<button onClick={() => setCurrentModule('1867')}>
  1867: PartialDataMissing
</button>
```

**Transition Config:**
```tsx
initial={{ opacity: 0, x: 20 }}
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: -20 }}
transition={{ duration: 0.3 }}
```

## Use Case Modules

### Module 1: SolutionEmpty (1147)

**Scene 2 - Populated:**
- 5 widgets: Header, Chart, Filter, Object Table, Action
- Focus: "SolutionEmpty Detection & Remediation"
- Highlighted: ServiceProblems table

**Scene 3 - Configuration:**
- Object Set: ServiceProblem (TMF656)
- Properties: id, category, status, description
- Filter: Category = SolutionEmpty
- Multi-select enabled

**Scene 4 - Preview:**
- Stats: 247 total, 143 pending, 104 resolved
- Pie Chart: 58% SolutionEmpty, 32% PartialDataMissing, 10% Other
- Table: 5 sample rows with different statuses

### Module 2: PartialDataMissing (1867)

**Scene 2 - Populated:**
- 5 widgets: Header, Chart, Filter, Object Table, Action
- Focus: "Order Entry Data Patcher"
- Highlighted: ServiceProblems (OE Issues) table

**Scene 3 - Configuration:**
- Object Set: ServiceProblem (TMF656)
- Properties: id, category, status, orderEntry_id, missing_fields
- Filter: Category = PartialDataMissing
- Action Config: PICEmail, CompanyRegNo, ActivationDate input fields

**Scene 4 - Preview:**
- Stats: 79 total, 45 pending, 34 resolved
- Pie Chart: 45% PICEmail, 32% CompanyRegNo, 23% ActivationDate
- Table: 5 sample rows with missing field indicators

## Shared Components

### Scene1_Empty

Empty builder state used by both modules.

**Features:**
- Dark slate-950 background
- Empty canvas with placeholder text
- "Next Scene" button

### BuilderLayout

Three-panel layout (left, center, right) used in Scenes 2-3.

**Props:**
- `moduleName`: Title for the top bar
- `leftPanel`: Widget library
- `centerPanel`: Main canvas
- `rightPanel`: Configuration panel

### WidgetCard

Reusable card component for widgets.

**Props:**
- `type`: Widget type (header, chart, filter, objectTable, action)
- `title`: Card title
- `description`: Card description
- `highlight`: Boolean for purple border
- `showMenu`: Show three-dot menu
- `onClick`: Click handler

## Usage

### As a Standalone Page

Add to App.tsx:

```tsx
import SpeedrunBuilderDemo from './components/speedrun-builder-demo/SpeedrunBuilderDemo';

// In your component:
<SpeedrunBuilderDemo />
```

### As a Tab in the Main App

Add to the module navigation in App.tsx:

```tsx
type ModuleId = /* ... */ | 'speedrun-demo';

// In renderContent():
case 'speedrun-demo':
  return <SpeedrunBuilderDemo />;
```

## Navigation

**Module Switching:**
- Click "1147: SolutionEmpty" button to show first use case
- Click "1867: PartialDataMissing" button to show second use case
- Switching modules preserves current scene number

**Keyboard:**
- `←` Left Arrow: Previous scene
- `→` Right Arrow: Next scene

**Mouse:**
- Click dots in top-right corner to jump to any scene
- Click "Back to Builder" in Scene 4 to return to Scene 3

## Tech Stack

- **React 18** with TypeScript
- **Framer Motion** for transitions and animations
- **Tailwind CSS** for styling (using design tokens)
- **Lucide React** for icons

## Styling Conventions

All styling uses design tokens from `tailwind.config.js`:

- **Dark theme** (Scenes 1-3): `bg-slate-950`, `text-white`
- **Light theme** (Scene 4): `bg-neutral-50`, `text-neutral-900`
- **Brand colors**: `purple-500` for primary actions
- **Status colors**: `yellow-*` (pending), `blue-*` (in progress), `green-*` (resolved)
- **Neutral scale**: `neutral-*` for backgrounds, borders, text

## Animation Patterns

### Scene Transitions

```tsx
<AnimatePresence mode="wait">
  {renderScene()}
</AnimatePresence>
```

### Staggered List Items

```tsx
{items.map((item, idx) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.8 + idx * 0.05 }}
  >
    {/* content */}
  </motion.div>
))}
```

### Cards with Delays

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.1 }}
>
  {/* card content */}
</motion.div>
```

## Development

### Running Locally

```bash
cd bss-magic-app-template
npm install
npm run dev
```

Navigate to the speedrun demo tab or route.

### Testing Scenes

Use the dot indicators in the top-right corner to quickly jump between scenes during development.

### Updating Scene Content

To modify a scene, edit the corresponding `SceneX_*.tsx` file. Each scene is self-contained and receives navigation callbacks as props.

## Demo Flow

**Narrative:**
1. Start with Scene 1 (empty canvas)
2. Navigate to Scene 2 (shows 5 widgets for current module)
3. Click highlighted widget to go to Scene 3 (configuration)
4. Click "Preview Module" to go to Scene 4 (runtime dashboard)
5. Switch modules to see different use case with same pattern

**Key Message:**
"Here's how we'd build SolutionEmpty in Speedrun [shows 1147]. Now let me switch to PartialDataMissing [clicks 1867 button]. Same builder, different workflow. Two use cases, same process. That's Speedrun for Maxis."

## Future Enhancements

- [x] Add second use case (PartialDataMissing 1867)
- [ ] Add scene transition sound effects
- [ ] Add "Skip to Preview" button in Scene 1
- [ ] Add demo mode auto-play with timed transitions
- [ ] Add fullscreen mode toggle
- [ ] Add scene bookmarking/deep linking
- [ ] Add third use case module

## Notes

- Both modules (1147 and 1867) are fully implemented
- Module switcher demonstrates pattern reusability
- All components are properly typed with TypeScript
- Framer Motion transitions are smooth at 300ms
- The demo is self-contained and doesn't require external data
- Same builder interface, different data and configuration
