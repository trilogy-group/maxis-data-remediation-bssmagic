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


