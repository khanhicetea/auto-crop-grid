# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Image Grid Cropper** application built with React, Vite, and Tailwind CSS. The app allows users to upload an image and automatically crop it into a customizable grid layout with specified columns and rows, then download all cropped frames as a ZIP file.

## Technology Stack

- **Frontend**: React 18 with JSX
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 3 with PostCSS
- **File Processing**: JSZip for creating downloadable archives
- **Image Processing**: HTML5 Canvas API for cropping operations

## Development Commands

```bash
# Start development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Install dependencies
bun install
```

## Core Architecture

### Main Components Structure

- **`src/index.jsx`**: React app entry point that renders the main App component
- **`src/App.jsx`**: Single-file application containing all logic and UI
- **`src/index.css`**: Tailwind CSS imports only
- **`index.html`**: HTML entry point with root element

### Key Application Logic (App.jsx:1-215)

The application is structured as a single React component with these main functional areas:

1. **State Management**: Uses React hooks for file handling, grid configuration, and processing states
2. **Image Processing**: Canvas-based cropping algorithm that divides images into equal grid cells
3. **File Operations**: FileReader API for image loading, JSZip for downloadable archives
4. **UI Layout**: Responsive grid layout using Tailwind CSS classes

### Core Functions

- **`cropImage()`** (App.jsx:32-58): Main cropping logic using HTML5 Canvas to divide image into grid cells
- **`dataURLToBlob()`** (App.jsx:60-70): Converts canvas data URLs to Blob objects for ZIP creation
- **`downloadZip()`** (App.jsx:72-87): Creates and downloads ZIP archive using JSZip library

### Styling Approach

Uses Tailwind CSS utility classes exclusively:
- Responsive design with mobile-first approach
- Custom gradient backgrounds and shadow effects
- Grid layouts for both form controls and cropped image display
- Loading states and hover effects using Tailwind transitions

## File Processing Flow

1. User uploads image via file input
2. FileReader loads image as DataURL
3. Image object loads and triggers crop processing
4. Canvas API creates individual cropped frames
5. Frames stored as DataURLs in state
6. JSZip converts DataURLs to Blobs and creates downloadable archive

## Key Dependencies

- **React**: Component framework and state management
- **JSZip**: ZIP file creation for batch downloads
- **Vite**: Development server and build tool
- **Tailwind CSS**: Utility-first CSS framework

## Development Notes

- No external image processing libraries - uses native Canvas API
- Single-page application with client-side only processing
- Supports common image formats (JPG, PNG, GIF, WebP)
- Responsive design works on mobile and desktop
- No backend dependencies - fully standalone application