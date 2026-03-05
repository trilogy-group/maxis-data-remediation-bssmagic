//export const AI_TIER_URL_BASE = 'http://localhost:8002'
export const AI_TIER_URL_BASE = 'https://api.bss-magic.totogi.solutions'
export const APP_BUILDER_URL_BASE = 'http://23.21.75.95:3002'
//export const APP_BUILDER_URL_BASE = 'http://localhost:3002'

// S3 configuration for migration data
export const S3_SOURCE_PATH = 's3://totogi-migration-source/amdocs-data/'

// Migration execution control
export const SKIP_MIGRATION_EXECUTION = import.meta.env.VITE_MIGRATION_TRANSOFRMATION_NO_EXECUTION === 'true'