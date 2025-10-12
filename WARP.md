# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

AGILE3D-Demo is an Angular-based 3D demonstration project. Based on the project structure and .gitignore configuration, this is set up for Angular development with TypeScript.

## Setup Commands

This project appears to be in early setup phase. To initialize the Angular project:

```bash
# Install Angular CLI globally (if not already installed)
npm install -g @angular/cli

# Initialize Angular project (if not already done)
ng new . --directory=false --routing --style=css --skip-git

# Install dependencies
npm install
```

For 3D development, you'll likely need Three.js or similar:

```bash
# Install Three.js and types
npm install three
npm install --save-dev @types/three
```

## Development Commands

Once the Angular project is initialized:

```bash
# Start development server
ng serve

# Build for production
ng build

# Run tests
ng test

# Run end-to-end tests
ng e2e

# Lint the code
ng lint
```

## Architecture Notes

This project is intended to be a 3D demonstration built with Angular. Key considerations:

- **3D Rendering**: Likely will use Three.js, WebGL, or similar 3D libraries
- **Angular Components**: Structure 3D scenes as Angular components where possible
- **Performance**: 3D applications require careful performance optimization
- **Asset Management**: 3D models, textures, and assets will need proper loading and management

## Development Environment

- **IDE**: Currently configured for WebStorm/IntelliJ (.idea folder)
- **Platform**: Linux/Ubuntu development environment
- **Shell**: Fish shell
- **Node.js**: Will be required for Angular development

## File Structure Expectations

Once initialized, the project will follow standard Angular conventions:
- `src/app/` - Main application components
- `src/assets/` - Static assets (likely 3D models, textures)
- `angular.json` - Angular CLI configuration
- `package.json` - Dependencies and scripts