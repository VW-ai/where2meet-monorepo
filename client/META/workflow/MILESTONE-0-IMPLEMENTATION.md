# MILESTONE 0: Project Kickoff - Implementation Plan

> **Duration**: 1 day (6-8 hours)
> **Goal**: Complete development environment setup and project infrastructure

---

## Overview

This document provides a step-by-step implementation plan for Milestone 0. Follow each phase in order to ensure a properly configured development environment.

**Estimated Time Breakdown:**
- Phase 1: Next.js Project Setup (1-2 hours)
- Phase 2: Tooling & Configuration (1-2 hours)
- Phase 3: Folder Structure (1 hour)
- Phase 4: Git & CI/CD (1-2 hours)
- Phase 5: Verification (30 mins - 1 hour)

---

## Phase 1: Next.js Project Setup (1-2 hours)

### Step 1.1: Create Next.js 14 Project with App Router

**Command:**
```bash
npx create-next-app@latest where2meet-v1.0-client
```

**Configuration prompts (select these options):**
```
✔ Would you like to use TypeScript? … Yes
✔ Would you like to use ESLint? … Yes
✔ Would you like to use Tailwind CSS? … Yes
✔ Would you like to use `src/` directory? … Yes
✔ Would you like to use App Router? (recommended) … Yes
✔ Would you like to customize the default import alias (@/*)? … No
```

**Verify:**
```bash
cd where2meet-v1.0-client
ls -la
# Should see: src/, app/, next.config.js, package.json, etc.
```

---

### Step 1.2: Update TypeScript Configuration

**File: `tsconfig.json`**

Replace the entire file with:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    },

    // Strict mode settings
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Verify:**
```bash
npx tsc --noEmit
# Should show: "Found 0 errors"
```

---

### Step 1.3: Install Core Dependencies

**Install dependencies:**
```bash
npm install zustand lucide-react clsx tailwind-merge
npm install -D @types/google.maps
```

**Package list:**
- `zustand` - State management
- `lucide-react` - Icon library
- `clsx` - Conditional className utility
- `tailwind-merge` - Merge Tailwind classes
- `@types/google.maps` - Google Maps TypeScript types

**Verify:**
```bash
cat package.json | grep -A 10 "dependencies"
# Should see all packages listed
```

---

### Step 1.4: Configure Tailwind CSS with Custom Colors

**File: `tailwind.config.ts`**

Replace with:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Warm color palette for "simple & cute" design
        coral: {
          50: '#FFF5F5',
          100: '#FFE5E5',
          200: '#FFCCCC',
          300: '#FFB3B3',
          400: '#FF8A8A',
          500: '#FF6B6B', // Primary coral
          600: '#EE5A5A',
          700: '#DD4949',
          800: '#CC3838',
          900: '#BB2727',
        },
        mint: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#6BCB77', // Primary mint
          500: '#5BB968',
          600: '#4BA759',
          700: '#3B954A',
          800: '#2B833B',
          900: '#1B712C',
        },
        sunshine: {
          50: '#FFFBEB',
          100: '#FFF7CC',
          200: '#FFF3AA',
          300: '#FFEF88',
          400: '#FFE766',
          500: '#FFD93D', // Primary sunshine
          600: '#E6C337',
          700: '#CCAD31',
          800: '#B3972B',
          900: '#998125',
        },
        lavender: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A8A4FF', // Primary lavender
          500: '#9690F0',
          600: '#847CE1',
          700: '#7268D2',
          800: '#6054C3',
          900: '#4E40B4',
        },
        // UI colors
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};

export default config;
```

**File: `src/app/globals.css`**

Replace with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 4 92% 70%; /* Coral */
    --primary-foreground: 0 0% 100%;
    --secondary: 142 71% 59%; /* Mint */
    --secondary-foreground: 0 0% 100%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 48 100% 62%; /* Sunshine */
    --accent-foreground: 222.2 47.4% 11.2%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 4 92% 70%;
    --radius: 0.75rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  @apply bg-gray-100 rounded-full;
}

::-webkit-scrollbar-thumb {
  @apply bg-gray-300 rounded-full hover:bg-gray-400;
}
```

**Verify:**
```bash
npm run dev
# Visit http://localhost:3000 - should see styled Next.js default page
```

---

## Phase 2: Tooling & Configuration (1-2 hours)

### Step 2.1: Configure ESLint

**File: `.eslintrc.json`**

Replace with:

```json
{
  "extends": [
    "next/core-web-vitals",
    "next/typescript"
  ],
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

**Add lint scripts to `package.json`:**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,md}\"",
    "test": "echo \"No tests yet\" && exit 0"
  }
}
```

**Verify:**
```bash
npm run lint
# Should show: "No ESLint warnings or errors"
```

---

### Step 2.2: Configure Prettier

**Install Prettier:**
```bash
npm install -D prettier eslint-config-prettier
```

**File: `.prettierrc`**

Create new file:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**File: `.prettierignore`**

Create new file:

```
.next
node_modules
out
dist
build
.turbo
*.lock
package-lock.json
```

**Update `.eslintrc.json` to include Prettier:**

```json
{
  "extends": [
    "next/core-web-vitals",
    "next/typescript",
    "prettier"
  ],
  "rules": {
    // ... existing rules
  }
}
```

**Verify:**
```bash
npm run format
# Should format all files
```

---

### Step 2.3: Set Up Husky Pre-commit Hooks

**Install Husky and lint-staged:**
```bash
npm install -D husky lint-staged
npx husky init
```

**File: `.husky/pre-commit`**

Replace content with:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

**Make pre-commit executable:**
```bash
chmod +x .husky/pre-commit
```

**Add to `package.json`:**

```json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,css}": [
      "prettier --write"
    ]
  }
}
```

**Verify:**
```bash
# Make a dummy change and try to commit (test will run in Step 4)
```

---

### Step 2.4: Configure Next.js

**File: `next.config.js`**

Replace with:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },

  // Enable React Strict Mode
  reactStrictMode: true,

  // TypeScript error handling
  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
```

---

## Phase 3: Folder Structure Setup (1 hour)

### Step 3.1: Create Complete Folder Structure

**Run these commands:**

```bash
# Navigate to src directory
cd src

# Create all folders at once
mkdir -p app/{meet/[id],\(landing\)} \
         components/{landing,header,sidebar/{participant,venue},map,modals,ui,cat} \
         lib/{api,mock/{data,handlers},map,utils,hooks} \
         store \
         types \
         constants

# Go back to project root
cd ..
```

**Verify folder structure:**
```bash
tree src -L 3 -d
# Should show complete folder structure
```

---

### Step 3.2: Create Initial Files

**Create utility files:**

```bash
# Create cn utility (for className merging)
cat > src/lib/utils/cn.ts << 'EOF'
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
EOF

# Create types index
cat > src/types/index.ts << 'EOF'
// Export all types here
export * from './event';
export * from './participant';
export * from './venue';
export * from './map';
export * from './api';
EOF

# Create placeholder type files
touch src/types/{event,participant,venue,map,api}.ts

# Create constants
cat > src/constants/colors.ts << 'EOF'
export const CAT_COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-cyan-500',
] as const;

export type CatColor = typeof CAT_COLORS[number];
EOF
```

**Create Hello World landing page:**

**File: `src/app/(landing)/page.tsx`**

```bash
mkdir -p src/app/\(landing\)
cat > src/app/\(landing\)/page.tsx << 'EOF'
export default function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-coral-50 via-mint-50 to-lavender-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-coral-500 mb-4">
          Where2Meet
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Find the perfect meeting spot for everyone! 🐱
        </p>
        <div className="inline-block px-8 py-4 bg-coral-500 text-white rounded-full font-semibold hover:bg-coral-600 transition-colors cursor-pointer">
          Coming Soon...
        </div>
      </div>
    </div>
  );
}
EOF
```

**File: `src/app/(landing)/layout.tsx`**

```bash
cat > src/app/\(landing\)/layout.tsx << 'EOF'
export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
EOF
```

---

### Step 3.3: Create Environment Files

**File: `.env.local`**

```bash
cat > .env.local << 'EOF'
# Mock API Mode (set to 'true' for development without backend)
NEXT_PUBLIC_USE_MOCK_API=true

# Backend API URL (your external backend)
# Only used when NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_API_URL=http://localhost:8000

# Google Maps API Key (required - get from Google Cloud Console)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
```

**File: `.env.example`**

```bash
cat > .env.example << 'EOF'
# Copy this file to .env.local and fill in your values

# Mock API Mode (set to 'true' for development without backend)
NEXT_PUBLIC_USE_MOCK_API=true

# Backend API URL (required when not using mock API)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Google Maps API Key (required)
# Get yours at: https://console.cloud.google.com/google/maps-apis
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
```

**Update `.gitignore`:**

```bash
echo "
# Environment variables
.env.local
.env*.local

# OS files
.DS_Store
Thumbs.db
" >> .gitignore
```

---

## Phase 4: Git & CI/CD Setup (1-2 hours)

### Step 4.1: Initialize Git Repository

**Initialize Git:**
```bash
git init
git add .
git commit -m "chore: initial project setup

- Initialize Next.js 14 with App Router
- Configure TypeScript strict mode
- Set up Tailwind CSS with custom color palette
- Add ESLint, Prettier, Husky
- Create folder structure per CLIENT_ARCHITECTURE.md
- Add environment variables
- Create Hello World landing page

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Verify:**
```bash
git log
# Should show initial commit
```

---

### Step 4.2: Create GitHub Repository

**Create repository on GitHub:**

1. Go to https://github.com/new
2. Repository name: `where2meet-v1.0-client`
3. Description: "Where2Meet - Find the perfect meeting spot 🐱"
4. Keep it Private (or Public)
5. Do NOT initialize with README (we already have commits)
6. Click "Create repository"

**Connect local repo to GitHub:**

```bash
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/where2meet-v1.0-client.git
git branch -M main
git push -u origin main
```

**Verify:**
```bash
git remote -v
# Should show origin pointing to your GitHub repo
```

---

### Step 4.3: Configure Branch Protection

**On GitHub:**

1. Go to repository Settings → Branches
2. Click "Add branch protection rule"
3. Branch name pattern: `main`
4. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Do not allow bypassing the above settings
5. Click "Create"

---

### Step 4.4: Set Up GitHub Actions CI/CD

**File: `.github/workflows/ci.yml`**

```bash
mkdir -p .github/workflows
cat > .github/workflows/ci.yml << 'EOF'
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  quality:
    name: Code Quality & Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript type check
        run: npm run type-check

      - name: ESLint
        run: npm run lint

      - name: Run tests
        run: npm run test

      - name: Build production bundle
        run: npm run build
        env:
          NEXT_PUBLIC_USE_MOCK_API: true
          NEXT_PUBLIC_API_URL: http://localhost:8000
          NEXT_PUBLIC_APP_URL: http://localhost:3000

      - name: Check bundle size
        run: |
          BUNDLE_SIZE=$(du -sh .next | cut -f1)
          echo "Bundle size: $BUNDLE_SIZE"
          echo "✅ Build successful"

  # Optional: Deploy preview for PRs
  # deploy-preview:
  #   name: Deploy Preview
  #   runs-on: ubuntu-latest
  #   needs: quality
  #   if: github.event_name == 'pull_request'
  #   steps:
  #     - uses: actions/checkout@v4
  #     - uses: amondnet/vercel-action@v20
  #       with:
  #         vercel-token: ${{ secrets.VERCEL_TOKEN }}
  #         vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
  #         vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
EOF
```

**Commit and push:**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions CI/CD pipeline

- TypeScript type checking
- ESLint validation
- Test suite execution
- Production build verification

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

git push
```

**Verify:**
- Go to GitHub → Actions tab
- You should see the workflow running

---

## Phase 5: Verification & Testing (30 mins - 1 hour)

### Step 5.1: Run All Quality Checks

**TypeScript:**
```bash
npm run type-check
# Expected: "Found 0 errors"
```

**ESLint:**
```bash
npm run lint
# Expected: No errors or warnings
```

**Prettier:**
```bash
npm run format
# Expected: All files formatted
```

**Build:**
```bash
npm run build
# Expected: Build successful
```

---

### Step 5.2: Test Development Server

**Start dev server:**
```bash
npm run dev
```

**Test in browser:**

1. Open http://localhost:3000
2. Should see:
   - ✅ "Where2Meet" heading in coral color
   - ✅ Gradient background (coral → mint → lavender)
   - ✅ "Coming Soon..." button
   - ✅ Cat emoji 🐱
3. Check browser console: No errors

**Test responsive design:**
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M)
3. Test at:
   - ✅ 375px (Mobile)
   - ✅ 768px (Tablet)
   - ✅ 1024px (Desktop)

---

### Step 5.3: Test Pre-commit Hooks

**Test Husky:**

```bash
# Create a test file with bad formatting
echo "const  foo =    'bar';" > test.ts

# Try to commit
git add test.ts
git commit -m "test: check pre-commit hooks"

# Expected:
# - Prettier should auto-format the file
# - ESLint should run
# - Commit should succeed if no errors

# Clean up
git reset HEAD~1
rm test.ts
```

---

### Step 5.4: Review META Documentation

**Read these documents:**

```bash
# Open in your editor
open META/CLAUDE.md
open META/architecture/CLIENT_ARCHITECTURE.md
open META/architecture/COMPONENT_GUIDE.md
open META/UIUX/UIUX_GUIDE.md
open META/workflow/WORKFLOW-GUIDE.md
```

**Checklist:**
- [ ] Understand folder structure from CLIENT_ARCHITECTURE.md
- [ ] Understand color palette from UIUX_GUIDE.md
- [ ] Understand component hierarchy from COMPONENT_GUIDE.md
- [ ] Understand workflow from WORKFLOW-GUIDE.md
- [ ] Know how to use CLAUDE.md as reference

---

## Final Checklist

### ✅ Deliverables

- [ ] ✅ Working Next.js development server (`npm run dev`)
- [ ] ✅ TypeScript configuration with zero errors
- [ ] ✅ Tailwind CSS configured with warm color palette
- [ ] ✅ Git repository with main branch
- [ ] ✅ CI/CD pipeline configured (GitHub Actions)
- [ ] ✅ All team members have environment running

### ✅ Success Criteria

- [ ] `npm run dev` starts without errors
- [ ] `npm run type-check` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] Hello World page displays at `http://localhost:3000`
- [ ] Git pre-commit hooks working (Husky + lint-staged)
- [ ] GitHub Actions workflow running successfully
- [ ] All META documentation reviewed

---

## Troubleshooting

### Issue: TypeScript errors on build

**Solution:**
```bash
# Delete .next and node_modules
rm -rf .next node_modules
npm install
npm run type-check
```

### Issue: ESLint errors

**Solution:**
```bash
npm run lint:fix
# Review and manually fix remaining issues
```

### Issue: Husky hooks not running

**Solution:**
```bash
npx husky init
chmod +x .husky/pre-commit
git config core.hooksPath .husky
```

### Issue: Google Maps API key not working

**Solution:**
1. Go to https://console.cloud.google.com/google/maps-apis
2. Enable these APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
   - Directions API
3. Create credentials → API Key
4. Copy to `.env.local`

### Issue: Port 3000 already in use

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000
# Kill it
kill -9 <PID>
# Or use different port
npm run dev -- -p 3001
```

---

## Next Steps

After completing Milestone 0:

1. **Review Milestone 1** in [MILESTONE.md](MILESTONE.md)
2. **Create feature specs**:
   - `docs/features/landing-page.md`
   - `docs/features/event-creation.md`
3. **Begin implementation** following [WORKFLOW-GUIDE.md](WORKFLOW-GUIDE.md)

---

## Quick Reference Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run start            # Start production server

# Quality Checks
npm run type-check       # TypeScript validation
npm run lint             # ESLint
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier format

# Git
git status               # Check status
git add .                # Stage all changes
git commit -m "message"  # Commit with message
git push                 # Push to remote

# Testing pre-commit hooks
git commit --no-verify   # Skip hooks (emergency only)
```

---

**Milestone 0 Status**: 🟢 Ready to Start

**Estimated Completion Time**: 6-8 hours

**Last Updated**: 2024-11-21
