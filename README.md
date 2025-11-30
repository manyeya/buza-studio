<div align="center">
  <img src="public/logo.svg" width="120" height="120" alt="Buza Studio Logo" />
  <h1>Buza Studio</h1>
  <p><strong>The Ultimate Local-First Prompt Engineering Environment</strong></p>
  
  <p>
    <a href="https://tauri.app"><img src="https://img.shields.io/badge/Tauri-2.0-FEC130?style=flat&logo=tauri&logoColor=black" alt="Tauri" /></a>
    <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black" alt="React" /></a>
    <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-1.0-000000?style=flat&logo=bun&logoColor=white" alt="Bun" /></a>
    <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat&logo=tailwindcss&logoColor=white" alt="TailwindCSS" /></a>
  </p>
</div>

<br />

**Buza Studio** is a high-fidelity, node-based prompt engineering tool designed for developers and AI engineers who demand precision and aesthetics. Built with a "Spotify-inspired" dark theme, it offers a premium, distraction-free environment for crafting, testing, and optimizing LLM prompts.

## ✨ Features

- **🎨 High-Fidelity UI**: A sleek, dark-mode interface with "Spotify Green" (`#1DB954`) accents, glassmorphism effects, and smooth transitions.
- **🧠 Smart Variable Tracking**: Automatically detects and tracks variables in your prompts using `{{variable}}` syntax.
- **🤖 AI Integration**: Built-in support for **Google Gemini** to generate prompt structures, optimize content, and run variations.
- **⚡ Local-First & Fast**: Built on **Tauri** and **Bun** for native performance and complete data privacy. Your prompts stay on your machine.
- **🔄 Version Control**: Save versions, restore history, and manage prompt variants effortlessly.
- **🧩 Template Library**: Start quickly with built-in templates or save your own for reuse.

## 🛠️ Tech Stack

- **Core**: [Tauri v2](https://tauri.app) (Rust + Webview)
- **Frontend**: [React 19](https://react.dev), [Vite](https://vitejs.dev)
- **Styling**: [TailwindCSS v4](https://tailwindcss.com), [Shadcn UI](https://ui.shadcn.com)
- **State Management**: [Jotai](https://jotai.org)
- **Runtime**: [Bun](https://bun.sh)

## 🚀 Getting Started

### Prerequisites

- **Bun**: [Install Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- **Rust**: [Install Rust](https://www.rust-lang.org/tools/install) (Required for Tauri)
- **Node.js**: (Optional, but recommended for some tools)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/buza-studio.git
   cd buza-studio
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up Environment**
   Create a `.env` file in the root directory and add your API keys:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

### Running Locally

Start the development server with Tauri:

```bash
bun tauri:dev
```

This will launch the native application window.

## 🎨 Brand Identity

Buza Studio follows a strict design system to ensure a premium user experience.

- **Primary Color**: Spotify Green `#1DB954`
- **Backgrounds**: Dark Grays `#121212`, `#181818`, `#282828`
- **Typography**: [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts)
- **Iconography**: Lucide React & Radix Icons

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT
