#!/bin/bash

# Build script for Bun REST API sidecar
# Automatically detects the target triple and compiles the binary

set -e

# Detect the target triple
TARGET_TRIPLE=$(rustc -vV | grep host | cut -d' ' -f2)

echo "🔍 Detected target triple: $TARGET_TRIPLE"

# Create binaries directory if it doesn't exist
mkdir -p src-tauri/binaries

# Compile the Bun server
echo "🔨 Compiling Bun server..."
bun build --compile sidecar/server.ts --outfile "src-tauri/binaries/api-$TARGET_TRIPLE"

# Make the binary executable
chmod +x "src-tauri/binaries/api-$TARGET_TRIPLE"

echo "✅ Sidecar binary created: src-tauri/binaries/api-$TARGET_TRIPLE"
echo "📦 Binary size: $(du -h "src-tauri/binaries/api-$TARGET_TRIPLE" | cut -f1)"
