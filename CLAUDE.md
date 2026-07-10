# Claude Code Project Configuration - OHAYO! 🌸

## Build and Development Commands
- Dev server: `npm run dev`
- Production build: `npm run build`
- Start built server: `npm run start`
- Linting: `npm run lint`

## Project Structure & Stack
- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + CSS Variables (`src/app/globals.css`)
- **Key Directories**:
  - `src/app/`: Next.js pages and layouts
  - `src/components/`: Reusable UI and domain-specific components
  - `src/hooks/`: Custom React hooks (e.g., vocabulary storage)
  - `src/lib/`: Constants, mock data, and utility functions
  - `src/types/`: TypeScript definitions

## Critical Development Rules & Warnings
- **Important Next.js Notice**: This project uses a custom version of Next.js that may differ from your training data. **Always refer to the guide in `node_modules/next/dist/docs/` before writing code.** Pay close attention to file conventions, layouts, and API deprecations.
- **Paths**: Use `@/` alias for absolute imports.
- **Code Integrity**: Retain existing comments and documentation unless instructed otherwise.
- **Design Tokens**: Do not use hardcoded colors/spacing where possible; instead, use the CSS variables defined in `src/app/globals.css`.
