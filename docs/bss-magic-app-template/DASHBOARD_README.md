# BSS Magic Dashboard - Implementation Guide

## Overview

This dashboard is built based on the **TS_Dashboard_Requirements_Specification.md** and provides a comprehensive interface for monitoring and remediating data migration issues in the Maxis CloudSense-to-TMF ecosystem.

## Technology Stack

- **Framework:** React 19 + Vite
- **Language:** TypeScript 5.9+
- **Data Fetching:** @tanstack/react-query
- **Styling:** TailwindCSS
- **Icons:** Lucide React
- **Authentication:** AWS Cognito (existing AuthWrapper)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Top Header (Logo + User Dropdown)               │
├────────────┬────────────────────────────────────────────┤
│  Sidebar   │        Main Content Area                   │
│            │                                            │
│ 🔧 1867    │   Selected Module Content                  │
│ 📦 1147    │   (Order Not Generated, etc.)              │
│ ⚠️ Order   │                                            │
│ 🔌 IoT     │   React 19 + TanStack Query                │
│ 📋 TMF656  │                                            │
│            │                                            │
│ (expand/   │   Connects to TMF APIs ↓                   │
│  collapse) │                                            │
└────────────┴────────────────────────────────────────────┘
                        │                │
                ┌───────┴────────┐   ┌──┴──────────────┐
                │                │   │                  │
         ┌──────▼──────┐  ┌─────▼─────┐  ┌─────────────▼──────────┐
         │  CloudSense │  │  1147-     │  │  BSS Magic Runtime     │
         │ JS Gateway  │  │  Gateway   │  │  (TMF API Server)      │
         │  Port: 8080 │  │ Port: 8081 │  │  AWS ECS/PostgreSQL    │
         └─────────────┘  └────────────┘  └────────────────────────┘
```

## Project Structure

```
src/
├── components/
│   ├── Dashboard/              # Reusable dashboard components
│   │   ├── StatusBadge.tsx     # Status badge with colors
│   │   ├── CategoryBadge.tsx   # Category badge for TMF656
│   │   ├── Loader.tsx          # Loading spinners
│   │   ├── ServiceCard.tsx     # TMF638 Service card
│   │   ├── ProductCard.tsx     # TMF637 Product card
│   │   ├── ShoppingCartCard.tsx # TMF663 Cart card
│   │   └── ProductOrderCard.tsx # TMF622 Order card
│   └── Modules/                # 5 Remediation modules
│       ├── OEPatcherModule.tsx        # 1867 OE Data Patcher
│       ├── SolutionEmptyModule.tsx    # 1147 Solution Empty
│       ├── OrderNotGeneratedModule.tsx # Order Not Generated
│       ├── IoTQBSModule.tsx           # IoT QBS Remediator
│       └── ServiceProblemsModule.tsx  # TMF656 Problems
├── pages/
│   └── Dashboard.tsx           # Main dashboard with module navigation
├── services/
│   ├── tmf/                    # TMF API integration
│   │   ├── client.ts           # API client functions
│   │   ├── hooks.ts            # React Query hooks
│   │   └── index.ts
│   └── gateways/               # Gateway integrations
│       ├── cloudsense-gateway.ts # CloudSense JS Gateway
│       ├── gateway-1147.ts     # 1147 Gateway
│       ├── hooks.ts            # Gateway React Query hooks
│       └── index.ts
├── types/
│   └── tmf-api.ts              # All TMF types & interfaces
├── App.tsx                     # App entry with auth wrapper
└── main.tsx                    # React root with QueryClient
```

## 5 Remediation Modules

### 1. 🔧 1867 OE Data Patcher (`oe-patcher`)

**Purpose:** Detect and patch missing Order Enrichment (OE) attributes on MACD baskets

**Features:**
- 4 scenario tabs: Fibre+Voice, Fibre-Only, Mobile+ESMS, Access+Voice
- Automatic detection via TMF638 custom fields (`x_has1867Issue`, `x_fibreVoiceOE`, etc.)
- Integration with CloudSense JS Gateway (OE data retrieval)
- Integration with 1147-Gateway (OE patching)
- Shows required OE fields per scenario

**TMF APIs Used:** TMF638 (Service), TMF666 (BillingAccount), TMF632 (Individual)

### 2. 📦 1147 Solution Empty (`solution-empty`)

**Purpose:** Re-migrate solutions with empty/incomplete configurations

**Features:**
- Detects products with `status="Not Migrated Successfully"`
- Shows failed migration statistics
- "Fix Migration" button creates TMF656 ServiceProblem
- Integrated ServiceProblems view filtered by category
- Automatic remediation trigger

**TMF APIs Used:** TMF637 (Product), TMF656 (ServiceProblem)

### 3. ⚠️ Order Not Generated (`order-not-gen`)

**Purpose:** Fix baskets stuck in "Order Generation" due to high AsyncApexJob queue

**Features:**
- Detects stuck baskets (status="Order Generation")
- Explains root cause (AsyncApexJob queue > 100)
- Shows manual remediation steps
- SOQL queries for detection

**TMF APIs Used:** TMF663 (ShoppingCart)

### 4. 🔌 IoT QBS Remediator (`iot-qbs`)

**Purpose:** Repair corrupted PC linkages in IoT solutions

**Features:**
- Shows active services and in-progress orders
- Explains TMF653 requirement (not yet implemented)
- Detection query placeholder
- Manual remediation steps

**TMF APIs Used:** TMF638 (Service), TMF622 (ProductOrder)
**Note:** Full detection requires TMF653 (TaskFlow) - coming soon

### 5. 📋 Service Problems (`remediation-history`)

**Purpose:** Track all confirmed issues and remediation progress

**Features:**
- Lists all TMF656 ServiceProblems
- Filter by status (pending, resolved, etc.)
- Filter by category (SolutionEmpty, PartialDataMissing, etc.)
- Expandable tracking records
- Links to Apex job details
- Real-time status updates

**TMF APIs Used:** TMF656 (ServiceProblem)

## Environment Configuration

Create a `.env.local` file (see `.env.example`):

```bash
# TMF API Configuration
VITE_TMF_API_URL=http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com
VITE_BSSMAGIC_API_KEY=bssmagic-d58d6761265b01accc13e8b21bae8282
VITE_TMF_ENVIRONMENT=production  # or 'sandbox'

# Gateway URLs
VITE_GATEWAY_CLOUDSENSE_URL=http://localhost:8080
VITE_GATEWAY_1147_URL=http://localhost:8081

# Feature Flags
VITE_USE_MOCK_DATA=false
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Python 3.9+ (for gateways)
- Running gateways on ports 8080 and 8081

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:3001
```

### Running Gateways (Optional)

**CloudSense JS Gateway (Port 8080):**
```bash
cd cloudsense-js-gateway
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

**1147-Gateway (Port 8081):**
```bash
cd 1147-gateway
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8081 --reload
```

## Key Features

### React Query Integration

All data fetching uses React Query for:
- Automatic caching (30-60 seconds)
- Background refetching
- Loading states
- Error handling
- Optimistic updates

```typescript
// Example hook usage
const { data, isLoading, error, refetch } = useServices({
  limit: 20,
  x_serviceType: 'Voice',
  x_migratedData: true,
});
```

### TMF API Integration

Direct integration with BSS Magic Runtime TMF APIs:

- **TMF637** - Product Inventory (Solutions)
- **TMF638** - Service Inventory (Services with 1867 detection)
- **TMF622** - Product Ordering (Orders)
- **TMF663** - Shopping Cart (Baskets)
- **TMF666** - Account Management (Billing Accounts)
- **TMF632** - Party Management (Contacts)
- **TMF656** - Service Problem Management (Issue tracking)

### Custom Views

The dashboard leverages custom SQL views in the TMF runtime:

- `solution1867FibreVoice` - Fibre+Voice 1867 candidates
- `solution1867FibreOnly` - Fibre-only 1867 candidates
- `solution1867MobileEsms` - Mobile+ESMS 1867 candidates
- `solution1867AccessVoice` - Access+Voice 1867 candidates
- `failedMigrationProduct` - Failed migrations

### Responsive Design

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Grid layouts adapt to screen size
- Sticky headers for better UX

### Dark Mode Support

All components support dark mode via Tailwind's `dark:` classes:
- Automatic system preference detection
- Consistent color scheme across all modules
- Readable text contrast ratios (WCAG 2.1 compliant)

## Development

### Adding New Modules

1. Create component in `src/components/Modules/`
2. Add to `modules` array in `Dashboard.tsx`
3. Implement module interface with TMF API hooks
4. Export from `src/components/Modules/index.ts`

### Adding New TMF Endpoints

1. Add types to `src/types/tmf-api.ts`
2. Add client function to `src/services/tmf/client.ts`
3. Add React Query hook to `src/services/tmf/hooks.ts`
4. Use hook in component

### Testing

```bash
# Run linter
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## TMF Standard References

- [TMF637 - Product Inventory Management](https://www.tmforum.org/oda/implementation/ig-rest-api-product-inventory-api-r19-5/)
- [TMF638 - Service Inventory Management](https://www.tmforum.org/oda/implementation/ig-rest-api-service-inventory-api-r19-5/)
- [TMF656 - Service Problem Management](https://www.tmforum.org/oda/implementation/ig-rest-api-service-problem-api-r19-5/)

## Troubleshooting

### Common Issues

**1. TMF API Connection Failed**
- Check `VITE_TMF_API_URL` in `.env.local`
- Verify API key is correct
- Check network connectivity to AWS runtime

**2. Gateway Connection Failed**
- Ensure gateways are running on ports 8080/8081
- Check gateway health endpoints: `/health`
- Verify CORS settings

**3. React Query Errors**
- Check browser console for detailed error messages
- Verify API response format matches TypeScript interfaces
- Check React Query DevTools (if enabled)

### Debug Mode

Enable verbose logging:
```typescript
// In main.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // Disable retry for debugging
    },
  },
  logger: {
    log: console.log,
    warn: console.warn,
    error: console.error,
  },
});
```

## Performance Optimization

- **Code Splitting:** Modules loaded on demand
- **React Query Caching:** 30-60 second stale time
- **Optimistic Updates:** Immediate UI feedback
- **Debounced Refetch:** Prevents excessive API calls

## Security

- API key stored in environment variables (never committed)
- AWS Cognito authentication via existing AuthWrapper
- HTTPS recommended for production
- No sensitive data in localStorage

## Deployment

### Production Build

```bash
npm run build
# Output: dist/ folder
```

### Environment-Specific Builds

```bash
# Sandbox
VITE_TMF_ENVIRONMENT=sandbox npm run build

# Production (default)
npm run build
```

## Future Enhancements

1. **TMF653 Integration** - Full IoT QBS detection
2. **Real-Time Updates** - WebSocket for live status
3. **Bulk Operations** - Multi-select and batch actions
4. **Advanced Filters** - Date ranges, multi-select
5. **Export Functionality** - CSV/Excel/PDF reports
6. **Full OE Patching UI** - Complete integration with gateways

## Contributing

Please follow these guidelines:
- Use TypeScript strict mode
- Follow existing component patterns
- Add JSDoc comments for complex functions
- Test with both light and dark modes
- Ensure responsive design on all screen sizes

## Support

For issues or questions:
1. Check this README
2. Review the specification: `TS_Dashboard_Requirements_Specification.md`
3. Contact BSS Magic team

---

**Version:** 2.0  
**Last Updated:** January 21, 2026  
**Built By:** BSS Magic Team
