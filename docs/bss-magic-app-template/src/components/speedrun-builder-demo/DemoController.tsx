import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Scene1_Empty from './Scene1_Empty';
import Scene2_Populated from './Scene2_Populated';
import Scene3_Config from './Scene3_Config';
import Scene4_Preview from './Scene4_Preview';
import Scene2_Populated_1867 from './Scene2_Populated_1867';
import Scene3_Config_1867 from './Scene3_Config_1867';
import Scene4_Preview_1867 from './Scene4_Preview_1867';

type SceneNumber = 1 | 2 | 3 | 4;
type ModuleType = '1147' | '1867';

const DemoController: React.FC = () => {
  const [currentScene, setCurrentScene] = useState<SceneNumber>(1);
  const [currentModule, setCurrentModule] = useState<ModuleType>('1147');

  const nextScene = () => {
    if (currentScene < 4) {
      setCurrentScene((prev) => (prev + 1) as SceneNumber);
    }
  };

  const prevScene = () => {
    if (currentScene > 1) {
      setCurrentScene((prev) => (prev - 1) as SceneNumber);
    }
  };

  const goToScene = (scene: SceneNumber) => {
    setCurrentScene(scene);
  };

  // Handle back button from Scene 4 - return to Scene 3 (configuration)
  const handleBackFromPreview = () => {
    goToScene(3);
  };

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        nextScene();
      } else if (e.key === 'ArrowLeft') {
        prevScene();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentScene]);

  const renderScene = () => {
    // For 1147 (SolutionEmpty)
    if (currentModule === '1147') {
      switch (currentScene) {
        case 1:
          return <Scene1_Empty key="scene1-1147" onNext={nextScene} />;
        case 2:
          return <Scene2_Populated key="scene2-1147" onNext={nextScene} onBack={prevScene} />;
        case 3:
          return <Scene3_Config key="scene3-1147" onNext={nextScene} onBack={prevScene} />;
        case 4:
          return <Scene4_Preview key="scene4-1147" onBack={handleBackFromPreview} />;
        default:
          return <Scene1_Empty key="scene1-1147" onNext={nextScene} />;
      }
    }

    // For 1867 (PartialDataMissing)
    if (currentModule === '1867') {
      switch (currentScene) {
        case 1:
          return <Scene1_Empty key="scene1-1867" onNext={nextScene} />;
        case 2:
          return <Scene2_Populated_1867 key="scene2-1867" onNext={nextScene} onBack={prevScene} />;
        case 3:
          return <Scene3_Config_1867 key="scene3-1867" onNext={nextScene} onBack={prevScene} />;
        case 4:
          return <Scene4_Preview_1867 key="scene4-1867" onBack={handleBackFromPreview} />;
        default:
          return <Scene1_Empty key="scene1-1867" onNext={nextScene} />;
      }
    }

    return <Scene1_Empty key="scene1-default" onNext={nextScene} />;
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Module Switcher */}
      <div className="absolute top-4 right-20 z-50 flex gap-2">
        <button
          onClick={() => setCurrentModule('1147')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            currentModule === '1147'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          1147: SolutionEmpty
        </button>
        <button
          onClick={() => setCurrentModule('1867')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            currentModule === '1867'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          1867: PartialDataMissing
        </button>
      </div>

      {/* Scene Navigation Indicator (Optional - for development) */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        {[1, 2, 3, 4].map((scene) => (
          <button
            key={scene}
            onClick={() => goToScene(scene as SceneNumber)}
            className={`w-3 h-3 rounded-full transition-all ${
              currentScene === scene
                ? 'bg-purple-500 w-8'
                : 'bg-slate-700 hover:bg-slate-600'
            }`}
            aria-label={`Go to scene ${scene}`}
          />
        ))}
      </div>

      {/* Scene Transition Container */}
      <AnimatePresence mode="wait">
        {renderScene()}
      </AnimatePresence>

      {/* Keyboard Navigation Helper (Optional - for development) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 text-slate-500 text-xs">
        Scene {currentScene} / 4 • Use arrow keys or dots to navigate
      </div>
    </div>
  );
};

export default DemoController;
