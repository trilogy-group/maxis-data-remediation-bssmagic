import React from 'react';
import DemoController from './DemoController';

/**
 * Speedrun Builder Demo
 *
 * A full-screen demo showing the Maxis SolutionEmpty detection and remediation workflow.
 * Consists of 4 scenes:
 * - Scene 1: Empty builder state
 * - Scene 2: Populated builder with components
 * - Scene 3: Configuration and settings
 * - Scene 4: Live preview of the runtime dashboard
 *
 * Navigation:
 * - Use arrow keys (left/right) to navigate between scenes
 * - Click dots in the top-right corner to jump to a specific scene
 * - Click "Back to Builder" in Scene 4 to return to Scene 3
 */
const SpeedrunBuilderDemo: React.FC = () => {
  return <DemoController />;
};

export default SpeedrunBuilderDemo;
