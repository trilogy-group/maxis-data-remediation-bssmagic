/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BSS_MAGIC_API_URL?: string
  readonly VITE_BSS_MAGIC_API_KEY?: string
  readonly VITE_BSSMAGIC_API_KEY?: string
  readonly VITE_LINEAR_API_KEY?: string
  readonly VITE_TMF_API_URL?: string
  readonly VITE_TMF_ENVIRONMENT?: string
  readonly VITE_ORCHESTRATOR_URL?: string
  readonly VITE_DEV_MODE?: string
  readonly VITE_ENABLED_MODULES?: string
  readonly VITE_GATEWAY_1147_URL?: string
  readonly VITE_GATEWAY_CLOUDSENSE_URL?: string
  readonly VITE_USE_MOCK_DATA?: string
  readonly VITE_SF_ENVIRONMENT_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.jpeg" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const value: string;
  export default value;
}