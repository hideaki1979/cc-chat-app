# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CC Chat App is a Turborepo monorepo containing a real-time chat application with:
- **Frontend**: Next.js 15 with React 19, TailwindCSS, and TypeScript
- **Backend**: Go API using Echo framework and Ent ORM
- **Database**: PostgreSQL with containerized development environment

## Development Commands

### Build Commands
```bash
# Build all apps and packages
pnpm build

# Build specific app
turbo build --filter=web
turbo build --filter=api
turbo build --filter=docs
```

### Development Server
```bash
# Start all development servers
pnpm dev

# Start specific app
turbo dev --filter=web     # Next.js on port 3003
turbo dev --filter=docs    # Docs on default port
```

### Go Backend Development
```bash
# Run Go API server (from apps/api directory)
cd apps/api
pnpm dev  # Uses Air for hot reload via .air.toml
# OR
go run main.go

# Database setup required:
# Set DATABASE_URL environment variable
# Set RUN_MIGRATIONS=true for schema creation
```

### Docker Development
```bash
# Full stack with database
docker-compose up

# Services:
# - PostgreSQL on port 5433
# - Go API on port 8080  
# - Next.js on port 3003
```

### Testing
```bash
# Frontend tests
cd apps/web
pnpm test              # Jest unit tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
pnpm test:e2e          # Playwright E2E tests
pnpm test:e2e:ui       # Playwright UI mode
```

### Linting and Type Checking
```bash
pnpm lint              # ESLint all packages
pnpm check-types       # TypeScript type checking
pnpm format           # Prettier formatting
```

## Architecture

### Monorepo Structure
```
apps/
├── web/          # Next.js frontend (port 3003)
├── api/          # Go backend (port 8080) 
└── docs/         # Documentation site

packages/
├── ui/                    # Shared React components
├── eslint-config/         # ESLint configurations
├── typescript-config/     # TypeScript configurations
└── tailwind-config/       # TailwindCSS configurations
```

### Backend Architecture (Go)
- **Framework**: Echo v4 for HTTP routing and middleware
- **ORM**: Ent for database schema and operations
- **Database**: PostgreSQL with connection pooling
- **Auth**: JWT-based authentication with middleware
- **Structure**:
  ```
  apps/api/
  ├── main.go              # Application entry point
  ├── internal/
  │   ├── handlers/        # HTTP request handlers
  │   ├── middleware/      # JWT auth middleware
  │   ├── auth/           # Authentication logic
  │   └── models/         # Data models
  └── ent/                # Generated ORM code
      └── schema/         # Database schema definitions
  ```

### Frontend Architecture (Next.js)
- **Framework**: Next.js 15 with App Router
- **State Management**: Zustand for client state
- **Forms**: React Hook Form with Zod validation
- **Styling**: TailwindCSS with shared design system
- **API**: Axios client with centralized configuration
- **Structure**:
  ```
  apps/web/app/
  ├── components/         # Reusable UI components
  ├── stores/            # Zustand stores
  ├── lib/              # Utilities and API client
  ├── types/            # TypeScript type definitions
  └── (routes)/         # App Router pages
  ```

## Key Technologies

### Frontend Stack
- **Next.js 15.3.0**: React framework with App Router
- **React 19.1.0**: UI library with modern features
- **TailwindCSS 4.1.11**: Utility-first CSS framework
- **TypeScript 5.8.x**: Type-safe development
- **Zustand 5.0.6**: Lightweight state management
- **React Hook Form 7.60.0**: Form handling with validation
- **Zod 4.0.5**: Schema validation
- **Axios 1.10.0**: HTTP client

### Backend Stack
- **Go 1.24.5**: Backend language
- **Echo v4.13.4**: HTTP web framework
- **Ent v0.14.4**: Entity framework (ORM)
- **JWT v5.3.0**: Authentication tokens
- **PostgreSQL**: Database via lib/pq driver
- **Air**: Hot reload for development
- **UUID**: Google UUID package for IDs

### Development Tools
- **Turborepo 2.5.5**: Monorepo build system
- **pnpm 9.0.0**: Package manager
- **ESLint 9.31.0**: Code linting
- **Prettier 3.6.2**: Code formatting
- **Jest 30.0.4**: Unit testing
- **Playwright**: E2E testing

## Database Schema

The application uses Ent ORM with PostgreSQL. Key entities:

### User Entity
```go
// Located in apps/api/ent/schema/user.go
- id: UUID (primary key)
- name: string (ユーザー名)
- email: string (unique, メールアドレス)
- password_hash: string (sensitive)
- profile_image_url: string (optional)
- bio: text (optional, 自己紹介文)
- created_at: timestamp
- updated_at: timestamp
```

## Authentication Flow

1. **Registration**: POST `/api/auth/register`
2. **Login**: POST `/api/auth/login` → Returns JWT token
3. **Protected Routes**: Use JWT middleware on `/api` group
4. **Frontend State**: Managed via Zustand auth store
5. **Token Storage**: Client-side token management

## Development Notes

- **Language**: Interface supports Japanese (ログイン, チャットアプリ, etc.)
- **Ports**: Web (3003), API (8080), PostgreSQL (5433)
- **Hot Reload**: Frontend via Turbopack, Backend via Air
- **Type Safety**: Full TypeScript coverage across frontend
- **Component Library**: Shared UI components in `@repo/ui`
- **Testing**: Comprehensive Jest + Playwright setup
- **Docker**: Multi-service development environment ready