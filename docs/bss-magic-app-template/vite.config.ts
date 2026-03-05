import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  
  const TMF_API_URL = env.VITE_TMF_API_URL || 'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com'
  const ORCHESTRATOR_URL = env.VITE_ORCHESTRATOR_URL || TMF_API_URL
  const API_KEY = env.VITE_BSSMAGIC_API_KEY || 'bssmagic-d58d6761265b01accc13e8b21bae8282'
  const TMF_ENVIRONMENT = env.VITE_TMF_ENVIRONMENT || 'production'
  
  // Build headers based on environment
  const proxyHeaders: Record<string, string> = {
    'X-API-Key': API_KEY,
  }
  
  // Add sandbox header if environment is sandbox
  if (TMF_ENVIRONMENT === 'sandbox') {
    proxyHeaders['X-Environment'] = 'sandbox'
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3001,
      open: true,
      proxy: {
        // Proxy TMF API requests to avoid CORS issues
        // Headers are set based on VITE_TMF_ENVIRONMENT
        '/tmf-api': {
          target: TMF_API_URL,
          changeOrigin: true,
          secure: false,
          headers: proxyHeaders,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              // Remove headers that might cause issues on ALB
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
              proxyReq.removeHeader('cookie');  // Remove cookies - they can cause auth issues
              // Log for debugging
              console.log(`[Proxy] ${req.method} ${req.url} -> ${TMF_API_URL}${req.url}`);
            });
            // Handle OPTIONS preflight - return success immediately
            proxy.on('proxyRes', (proxyRes, req, res) => {
              // Add CORS headers to all responses
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Environment');
            });
          },
          // Handle OPTIONS requests before proxying
          bypass: (req, res) => {
            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Environment');
              res.end();
              return false;
            }
            return null;
          },
        },
        // Sandbox API proxy - always adds X-Environment: sandbox header
        '/sandbox-api': {
          target: TMF_API_URL,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/sandbox-api/, '/tmf-api'),
          headers: {
            'X-API-Key': API_KEY,
            'X-Environment': 'sandbox',
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              // Remove origin header to avoid CORS issues on ALB
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
              console.log(`[Sandbox Proxy] ${req.method} ${req.url}`);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log(`[Sandbox Proxy] Response: ${proxyRes.statusCode} for ${req.method} ${req.url}`);
            });
            proxy.on('error', (err, req) => {
              console.error(`[Sandbox Proxy] Error for ${req.method} ${req.url}:`, err.message);
            });
          },
        },
        // Batch Orchestrator proxy (for unified remediation API)
        '/api/orchestrator': {
          target: ORCHESTRATOR_URL,
          changeOrigin: true,
          secure: false,
          headers: proxyHeaders,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
              proxyReq.removeHeader('cookie');
              console.log(`[Orchestrator Proxy] ${req.method} ${req.url} -> ${ORCHESTRATOR_URL}${req.url}`);
            });
            proxy.on('proxyRes', (proxyRes, req, res) => {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
            });
          },
          bypass: (req, res) => {
            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
              res.end();
              return false;
            }
            return null;
          },
        },
        // 1147-Gateway proxy for individual Apex REST API calls (local development)
        '/api/gateway-1147': {
          target: 'http://localhost:8081',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/gateway-1147/, '/api'),
        },
        // TMF API proxy through ts-dashboard (for CORS handling)
        '/api/tmf-api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        // Task API proxy through ts-dashboard (for Salesforce AsyncApexJob queries)
        '/api/task': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false, // Disable sourcemaps in production to save memory
      rollupOptions: {
        output: {
          manualChunks: {
            // Split heavy vendor libraries to reduce memory pressure
            'react-vendor': ['react', 'react-dom'],
            'monaco-vendor': ['monaco-editor'],
            'three-vendor': ['three'],
            'flow-vendor': ['@xyflow/react'],
            'ui-vendor': ['lucide-react', 'react-markdown'],
            'utils-vendor': ['moment', 'zustand', 'clsx', 'tailwind-merge']
          }
        }
      },
      chunkSizeWarningLimit: 1000, // Increase chunk size warning limit
      minify: 'esbuild' // Use esbuild for faster minification
    },
    define: {
      global: 'globalThis',
    },
    optimizeDeps: {
      include: ['monaco-editor']
    }
  }
})