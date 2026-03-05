/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BSS_MAGIC_API_URL?: string
  readonly VITE_BSS_MAGIC_API_KEY?: string
  readonly VITE_LINEAR_API_KEY?: string
  // Add more env variables as needed
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