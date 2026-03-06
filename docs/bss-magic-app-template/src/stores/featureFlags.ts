import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FeatureFlags {
  showTheFuture: boolean;
}

interface FeatureFlagsStore {
  flags: FeatureFlags;
  toggleFlag: (flagName: keyof FeatureFlags) => void;
  setFlag: (flagName: keyof FeatureFlags, value: boolean) => void;
  resetFlags: () => void;
}

const defaultFlags: FeatureFlags = {
  showTheFuture: false,
};

export const useFeatureFlags = create<FeatureFlagsStore>()(
  persist(
    (set) => ({
      flags: defaultFlags,
      toggleFlag: (flagName) =>
        set((state) => ({
          flags: { ...state.flags, [flagName]: !state.flags[flagName] },
        })),
      setFlag: (flagName, value) =>
        set((state) => ({
          flags: { ...state.flags, [flagName]: value },
        })),
      resetFlags: () => set({ flags: defaultFlags }),
    }),
    {
      name: 'feature-flags-storage',
    }
  )
);

const ALL_MODULE_IDS = [
  'oe-patcher',
  'oe-checker',
  'solution-empty',
  'order-not-gen',
  'iot-qbs',
  'remediation-history',
] as const;

const enabledRaw = import.meta.env.VITE_ENABLED_MODULES || '';
export const ENABLED_MODULES: string[] = enabledRaw
  ? (enabledRaw as string).split(',').map((m: string) => m.trim())
  : [...ALL_MODULE_IDS];

export function isModuleEnabled(moduleId: string): boolean {
  return ENABLED_MODULES.includes(moduleId);
}

export const HEALTH_CATEGORY_TO_MODULE: Record<string, string> = {
  'order-not-generated': 'order-not-gen',
  'partial-data-missing': 'oe-patcher',
  'solution-empty': 'solution-empty',
  'iot-qbs-issues': 'iot-qbs',
};

export function isHealthCategoryEnabled(categoryId: string): boolean {
  const moduleId = HEALTH_CATEGORY_TO_MODULE[categoryId];
  return !moduleId || isModuleEnabled(moduleId);
}
