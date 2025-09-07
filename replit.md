# DMV Compliance Research Application

## Overview

This is a full-stack DMV Compliance Research application built with Node.js/Express backend and React frontend. The system provides data ingestion, AI verification, analytics, and Excel export capabilities for vehicle compliance records. It features a modern dashboard with real-time charts, authentication-protected API endpoints, and comprehensive data management tools.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript and Vite as the build tool
- **UI Components**: Radix UI primitives with shadcn/ui design system
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Charts**: Chart.js for data visualization and analytics dashboards

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod for runtime type checking and API validation
- **Authentication**: Bearer token-based authentication middleware
- **File Processing**: ExcelJS for generating Excel exports
- **Development**: Hot reloading with tsx and Vite middleware integration

### Data Storage
- **Primary Database**: PostgreSQL via Neon serverless connection
- **ORM**: Drizzle ORM for type-safe database operations
- **Migration System**: Drizzle Kit for database schema migrations
- **Schema**: Shared TypeScript schema definitions between client and server

### API Design
- **REST Endpoints**: 
  - Health check (`/api/health`)
  - Data ingestion (`/api/ingestion/compliance`, `/api/ingestion/status`)
  - Analytics (`/api/analytics/summary`, `/api/analytics/trends`)
  - AI verification (`/api/verify`)
  - Excel export (`/api/export`)
- **Authentication**: Protected endpoints require Bearer token
- **Validation**: Request/response validation with Zod schemas
- **Error Handling**: Centralized error middleware with structured responses

### Authentication & Authorization
- **Bearer Token System**: Simple token-based authentication for API endpoints
- **Middleware**: Express middleware for optional and required authentication
- **Token Validation**: Basic token length validation (production would use JWT or similar)

## External Dependencies

### Database & ORM
- **@neondatabase/serverless**: Neon PostgreSQL serverless driver
- **drizzle-orm**: Type-safe ORM for database operations
- **drizzle-kit**: Database migration and schema management
- **ws**: WebSocket support for Neon connection

### Frontend Libraries
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/***: Headless UI component primitives
- **chart.js**: Charting library for analytics visualization
- **wouter**: Lightweight React router
- **date-fns**: Date manipulation utilities

### Development & Build Tools
- **vite**: Frontend build tool and development server
- **@vitejs/plugin-react**: React plugin for Vite
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Fast JavaScript bundler for production builds

### Styling & UI
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Utility for creating variant-based component APIs
- **clsx**: Conditional className utility

### Utility Libraries
- **zod**: Schema validation library
- **exceljs**: Excel file generation and manipulation
- **nanoid**: URL-safe unique ID generator

### Replit Integration
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Development tools integration