# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Overview

Buza Studio is an AI prompt engineering desktop application built with Tauri 2 + React 19 + TypeScript. It provides a Figma-inspired interface for creating, testing, and managing LLM prompts with the Google Gemini API.

## Development Commands

```bash
# Install dependencies
npm install  # or bun install

# Start development server (web only, port 3000)
npm run dev

# Run as Tauri desktop app (recommended for full functionality)
npm run tauri dev

# Build for production
npm run build

# Build Tauri app for distribution
npm run tauri build
```

## Environment Setup

Create `.env.local` with your Gemini API key:
```
GEMINI_API_KEY=your_api_key_here
```

## Architecture

### Tech Stack
- **Frontend**: React 19, TypeScript, Vite
- **Desktop**: Tauri 2 (Rust backend)
- **State**: Jotai (atoms) + TanStack React Query
- **AI**: Google Gemini via `@google/genai`
- **Templating**: Handlebars for prompt variable substitution
- **Styling**: Tailwind CSS via CDN with Figma-inspired dark theme (`figma-*` color tokens)

### Project Structure
```
├── App.tsx              # Main app component, state orchestration
├── index.tsx            # Entry point with React Query + Jotai providers
├── types.ts             # Core TypeScript interfaces
├── services/
│   └── geminiService.ts # Gemini API wrapper (runPrompt, optimizePrompt, generatePromptStructure)
├── src/
│   ├── components/      # React components (Sidebar, Workspace, PropertiesPanel, modals)
│   └── lib/
│       └── project-system.ts  # Filesystem-based project persistence
└── src-tauri/           # Rust Tauri backend
```

### Data Model
- **Project**: A folder in `~/Documents/buza-projects/` containing variants and a `project.json`
- **Variant**: A markdown file with YAML frontmatter (model config, variables) and prompt content
- **Variables**: Two types:
  - Project variables: `@{{key}}` - shared across all variants
  - Variant variables: `{{key}}` - scoped to specific variant

### Filesystem Structure
Projects are stored in `~/Documents/buza-projects/`:
```
buza-projects/
├── library.json        # Global variable library
├── templates.json      # Prompt templates
└── ProjectName/
    ├── project.json    # Project variables and description
    ├── Main.md         # Variant with YAML frontmatter
    └── Variant2.md
```

### Tauri Plugins Used
- `tauri-plugin-fs`: File system operations (scoped to `$DOCUMENT/**`)
- `tauri-plugin-shell`: Shell command execution
- `tauri-plugin-dialog`: Native dialogs

### Key Patterns
- All file operations use Tauri's `@tauri-apps/plugin-fs` with `BaseDirectory.Document`
- Variants use YAML frontmatter format: `---\nmodel: gemini-2.5-flash\ntemperature: 0.7\n---\n\nPrompt content here`
- The `projectSystem` singleton in `src/lib/project-system.ts` handles all persistence
