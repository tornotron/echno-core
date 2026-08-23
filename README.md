# @tornotron/echno-core

> Shared business logic for the Echno platform — domain types, API services, and data-fetching hooks used across every Echno client application.

---

## Table of Contents

- [@tornotron/echno-core](#tornotronechno-core)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Why echno-core](#why-echno-core)
  - [Tech Stack](#tech-stack)
  - [Architecture](#architecture)
    - [Three-layer pattern](#three-layer-pattern)
    - [DTO pattern](#dto-pattern)
    - [Enum translation](#enum-translation)
  - [Package Structure](#package-structure)
  - [What's Included](#whats-included)
    - [Domain types](#domain-types)
    - [Service functions](#service-functions)
    - [TanStack Query hooks](#tanstack-query-hooks)
    - [API client](#api-client)
    - [RBAC utilities](#rbac-utilities)
    - [Structured logger](#structured-logger)
  - [What Stays in Each App](#what-stays-in-each-app)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Providing server state context](#providing-server-state-context)
    - [Setting the API base URL](#setting-the-api-base-url)
    - [Injecting the auth token](#injecting-the-auth-token)
    - [Importing](#importing)
  - [API Client](#api-client-1)
  - [Development Workflow](#development-workflow)
    - [Making a change](#making-a-change)
    - [Watch mode](#watch-mode)
    - [Local development (skipping tags)](#local-development-skipping-tags)
    - [Adding a new domain module](#adding-a-new-domain-module)
  - [Versioning](#versioning)
  - [Requirements](#requirements)

---

## Overview

`@tornotron/echno-core` is the shared library at the centre of the Echno platform. It contains every piece of code that does not depend on a specific platform — the TypeScript domain types for every entity, the service functions that call the Spring Boot backend, and the TanStack Query hooks that manage server state in any React environment.

By extracting this code into its own package, all three client applications — web, iOS, and Android — share a single implementation. A bug fix in a service function or an update to a domain type is made once and propagates to every platform on the next version bump.

---

## Why echno-core

Before this package existed, domain types, service functions, and data hooks lived inside `echno-web`. That worked for a single app. Once mobile clients were introduced the options were:

1. **Copy-paste** — duplicate all shared code into each new repo and keep three copies in sync forever.
2. **Extract** — move the platform-agnostic code into a standalone package that any app can install.

This package is option 2. The benefits are:

- **Single source of truth** — domain types, field mappings, enum translations, and API contracts are defined once. Renaming a field or fixing a parsing bug fixes it everywhere simultaneously.
- **No runtime divergence** — all three apps are guaranteed to send and receive data in exactly the same shape because they use the same service and parsing functions.
- **Faster new clients** — `echno-apple` and `echno-android` start with all their data-fetching wired up on day one. They only need to build UI.
- **Smaller app bundles** — the package is compiled to ES modules. Tree-shaking removes any exported symbol a consuming app does not use.
- **Enforced separation of concerns** — the boundary between business logic and UI is a hard package boundary, not a folder convention that erodes over time.
- **Consistent RBAC** — role-checking utilities (`isAdmin`, `isManager`, etc.) are shared, so permission logic cannot silently differ between platforms.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Language | TypeScript 5 (strict mode) | End-to-end type safety across all exports |
| Build tool | `tsc` (TypeScript compiler) | Compiles `src/` to ESM JavaScript + `.d.ts` declarations in `dist/` |
| Package manager | Bun | Fast installs and script execution |
| Server-state management | TanStack Query v5 | All data-fetching hooks; cache invalidation and background refetching |
| HTTP client | Custom `ApiClient` (fetch-based) | Typed request/response handling, retries, configurable default headers |
| Validation | Zod | Runtime schema validation for API responses; parse functions on every domain type |
| RBAC | Custom role utilities | Keycloak JWT role checking (`isAdmin`, `isManager`, `hasPermission`) |
| Logging | Custom structured logger | Environment-aware log levels, consistent format across platforms |

---

## Architecture

```
echno-web      ──┐
echno-apple    ──┤──▶  @tornotron/echno-core  ──▶  Spring Boot backend
echno-android  ──┘               │
                                 │  types/       ← shared domain shapes
                                 │  services/    ← API call functions
                                 │  hooks/       ← TanStack Query wrappers
                                 │  lib/api/     ← HTTP client
                                 │  lib/rbac/    ← role & permission utils
                                 └  lib/utils/   ← shared helpers
```

### Three-layer pattern

Every domain module follows the same three-layer pattern:

```
types/<module>/          →  TypeScript interfaces + Zod parse functions
services/<module>-service.ts  →  API calls returning typed domain objects
hooks/<module>/          →  useQuery / useMutation wrappers with query key factories
```

Consuming apps import from whichever layer they need. Most UI components only need the hooks layer; hooks depend on services; services depend on types. Nothing in this package ever depends on a consuming app.

### DTO pattern

Create and update operations use explicit DTO types (`CreateProjectRequest`, `UpdateEmployeeRequest`, etc.) rather than partial domain objects. This ensures the shape sent to the backend is always intentional and validated, independent of what the domain object looks like after parsing the response.

### Enum translation

The backend uses `SCREAMING_SNAKE_CASE` for all enum values. The service layer translates between that and the `camelCase` conventions used in TypeScript so consuming apps never see backend-style strings.

---

## Package Structure

```
echno-core/
  src/
    types/                    # Domain type definitions
      project/                #   Project, ProjectStatus, CreateProjectRequest, …
      employee/               #   Employee, EmployeeRole, CreateEmployeeRequest, …
      task/                   #   Task, TaskPriority, CreateTaskRequest, …
      attendance/             #   Attendance, ClockEventType, AttendanceStatus, …
      leave/                  #   LeaveRequest, LeaveType, LeaveStatus, …
      vendor/                 #   Vendor, VendorContact, BankingDetails, …
      … (one folder per domain entity)
      index.ts                #   Re-exports all types

    services/                 # API service functions
      project-service.ts      #   getAll, getById, create, update, delete
      employee-service.ts
      task-service.ts
      attendance-service.ts   #   enum mapping, field translation
      leave-service.ts
      … (one file per domain entity)

    hooks/                    # TanStack Query hooks
      project/
        use-project.ts        #   useProjects, useProjectById
        use-project-mutations.ts  #   useCreateProject, useUpdateProject, …
      employee/
      task/
      attendance/
      leave/
      … (one folder per domain entity, matching services/)

    lib/
      api/
        api-client.ts         # ApiClient class — fetch wrapper with retries,
                              #   error handling, setDefaultHeader()
        api-services.ts       # Shared response type helpers
      rbac/
        permissions.ts        # Permission flag constants
        role-utils.ts         # isAdmin(), isManager(), hasPermission()
      utils/
        retry.ts              # Exponential backoff retry logic
        error-helpers.ts      # getErrorMessage() — normalises Error / string / unknown
        api-utils.ts          # ApiResponse<T>, ApiError, pagination types
      logger.ts               # Structured logger (debug / info / warn / error)

    index.ts                  # Single entry point — re-exports everything
  dist/                       # Compiled output (gitignored)
  package.json
  tsconfig.json
  .gitignore
```

---

## What's Included

### Domain types

A TypeScript interface and a Zod-backed parse function for every entity the backend exposes. Parse functions validate the raw API response at runtime and return a correctly typed domain object, or throw with a clear error message if the response shape is unexpected.

```typescript
import { Project, parseProject } from '@tornotron/echno-core';

const project: Project = parseProject(rawApiResponse);
```

### Service functions

Plain async functions — no hooks, no React — that call the backend and return typed domain objects. Safe to use in any JavaScript environment.

```typescript
import { projectService } from '@tornotron/echno-core';

const projects = await projectService.getAll();
const project  = await projectService.getById(42);
await projectService.create({ name: 'New Site', clientId: 7 });
await projectService.update(42, { status: 'active' });
await projectService.delete(42);
```

### TanStack Query hooks

`useQuery` and `useMutation` wrappers with stable query key factories and automatic cache invalidation on mutations. Drop-in compatible with any React app that has a `QueryClientProvider`.

```typescript
import { useProjects, useProjectById, useCreateProject } from '@tornotron/echno-core';

// In a component:
const { data: projects, isLoading } = useProjects();
const { data: project } = useProjectById(42);
const { mutate: createProject } = useCreateProject();
```

### API client

A `fetch`-based HTTP client with typed responses, configurable default headers, and automatic retries on transient failures.

```typescript
import { api, apiClient } from '@tornotron/echno-core';

// Low-level: typed HTTP methods
const response = await api.get<Project[]>('/projects');
const created  = await api.post<Project>('/projects', { name: 'New' });

// Set a header that persists across all future requests
apiClient.setDefaultHeader('X-Tenant-Id', orgId);
```

### RBAC utilities

Role-checking functions based on the Keycloak JWT roles attached to the current user.

```typescript
import { isAdmin, isManager, hasPermission } from '@tornotron/echno-core';

if (isAdmin(userRoles)) { /* show admin controls */ }
if (hasPermission(userRoles, 'attendance:approve')) { /* show approve button */ }
```

### Structured logger

A consistent logger that respects `NODE_ENV` — verbose in development, errors-only in production.

```typescript
import { logger } from '@tornotron/echno-core';

logger.info('Project fetched', { projectId: 42 });
logger.error('Failed to load attendance', error);
```

---

## What Stays in Each App

`echno-core` is intentionally platform-agnostic. Code that depends on a specific platform runtime is explicitly excluded:

| Concern | Where it lives | Why it cannot be shared |
|---|---|---|
| Auth session & token management | `echno-web` (`next-auth`), `echno-apple` (Keycloak iOS SDK) | Login flows are platform-specific |
| Navigation & routing hooks | Each app | Next.js router vs React Navigation vs Expo Router |
| Browser-only hooks (`useGeolocation`, `useInView`, `useMobile`) | `echno-web` | Depend on `window`, `navigator`, `IntersectionObserver` |
| UI components, features, layouts | Each app | Rendering is always platform-specific |
| CSS, Tailwind, animation utilities | `echno-web` | Web-only styling systems |
| Next.js middleware / proxy | `echno-web` | Next.js infrastructure |
| Push notification handlers | Mobile apps | Native device APIs |
| Deep link handlers | Mobile apps | Platform-specific URL schemes |

---

## Installation

Add to your app's `package.json` dependencies, pinned to a git tag:

```json
{
  "dependencies": {
    "@tornotron/echno-core": "github:tornotron/echno-core#v1.0.0"
  }
}
```

Then install:

```bash
bun install
```

Bun fetches the repository at the exact tag and places it in `node_modules/@tornotron/echno-core`. The compiled `dist/` output is what gets used — TypeScript source is available for reference but is not executed directly.

---

## Usage

### Providing server state context

Wrap your app's root with a `QueryClientProvider` (if not already done):

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* your app */}
    </QueryClientProvider>
  );
}
```

### Setting the API base URL

Set `NEXT_PUBLIC_API_URL` (web) or the platform-equivalent environment variable to your backend URL before any service calls are made.

The value may be **absolute** (e.g. `https://api.example.com`) — works in any runtime — or **relative** (e.g. `/api/v1`) — resolved against `globalThis.location.origin` at request time, which means it only works in a browser context. Use a relative value when calls are same-origin and proxied through the host app (e.g. Next.js route handlers).

### Injecting the auth token

After login, inject the Bearer token once. All subsequent API calls include it automatically:

```typescript
import { apiClient } from '@tornotron/echno-core';

// Call this once after the user authenticates
apiClient.setDefaultHeader('Authorization', `Bearer ${accessToken}`);

// Clear it on logout
apiClient.setDefaultHeader('Authorization', '');
```

### Importing

Everything is exported from the package root — no deep imports needed:

```typescript
// Types
import type { Project, Employee, Task, AttendanceRecord } from '@tornotron/echno-core';

// Services
import { projectService, employeeService, taskService } from '@tornotron/echno-core';

// Hooks
import { useProjects, useEmployees, useTasks, useCreateProject } from '@tornotron/echno-core';

// Utilities
import { api, apiClient, isAdmin, logger, getErrorMessage } from '@tornotron/echno-core';
```

---

## API Client

The `ApiClient` class is the HTTP layer used by all service functions. It wraps the native `fetch` API with:

- **Typed responses** — every method is generic: `api.get<T>()` returns `Promise<T>`.
- **Automatic retries** — transient network errors (5xx, timeouts) are retried with exponential backoff.
- **Default headers** — set once with `setDefaultHeader()`, applied to every request.
- **Unified error handling** — non-2xx responses throw a typed `ApiError` with status code and message.

```typescript
class ApiClient {
  get<T>(endpoint: string): Promise<T>
  post<T>(endpoint: string, body: unknown): Promise<T>
  patch<T>(endpoint: string, body: unknown): Promise<T>
  delete<T>(endpoint: string): Promise<T>
  postMultipart<T>(endpoint: string, form: FormData): Promise<T>
  setDefaultHeader(key: string, value: string): void
}
```

---

## Development Workflow

### Making a change

1. Edit files inside `src/`.
2. Compile and check for errors:
   ```bash
   bun run build
   ```
3. Commit, tag, and push:
   ```bash
   git add .
   git commit -m "feat: add movement records to attendance service"
   git tag v1.1.0
   git push origin main --tags
   ```
4. In each consuming app, bump the version pin and reinstall:
   ```json
   "@tornotron/echno-core": "github:tornotron/echno-core#v1.1.0"
   ```
   ```bash
   bun install
   ```

### Watch mode

```bash
bun run dev
```

Runs `tsc --watch` — recompiles on every file save. Useful when iterating rapidly.

### Local development (skipping tags)

To test changes in a consuming app before tagging a release, use a local file path temporarily:

```json
"@tornotron/echno-core": "file:../echno-core"
```

Run `bun install` after changing the path. Revert to the git tag reference before committing to the consuming app.

### Adding a new domain module

1. Create `src/types/<module>/index.ts` — define the domain type and a parse function.
2. Create `src/services/<module>-service.ts` — implement CRUD functions using `api.*`.
3. Create `src/hooks/<module>/use-<module>.ts` and `use-<module>-mutations.ts`.
4. Re-export from `src/index.ts`.
5. Build and fix any errors, then tag a new version.

### API reference

A full, browsable Markdown reference for every exported symbol (types, services,
hooks, and utilities) is generated from the source and its TSDoc comments with
[TypeDoc](https://typedoc.org):

```bash
bun run docs:api
```

The output lands in `docs/api/` (start at `docs/api/README.md`). This tree is
generated and gitignored, so regenerate it locally whenever you want to read the
current API surface. Configuration lives in `typedoc.json`.

---

## Versioning

This package follows [Semantic Versioning](https://semver.org):

| Change type | Version bump | Examples |
|---|---|---|
| Bug fix, non-breaking tweak | `PATCH` (1.0.x) | Fix a parse function, correct a field name |
| New export, backward-compatible addition | `MINOR` (1.x.0) | Add a new service, add optional fields to a type |
| Breaking change | `MAJOR` (x.0.0) | Rename an exported function, change a type's shape, remove an export |

Always pin consuming apps to an exact tag (`#v1.2.3`). Never point to a branch (`#main`); branch tips change and will break reproducible builds.

The public API is the set of entry points in the `exports` map, recorded in
[`etc/public-api.md`](etc/public-api.md) and enforced in CI by `bun run api:check`. Any change
to the exported surface shows up as a diff in that snapshot. See
[docs/API-STABILITY.md](docs/API-STABILITY.md) for the full policy.

---

## Requirements

| Dependency | Version | Notes |
|---|---|---|
| Bun | ≥ 1.0 | Recommended; Node ≥ 20 also works |
| TypeScript | ≥ 5.0 | Dev dependency — not bundled into `dist/` |
| React | ≥ 18.0 | Peer dependency — must be provided by the consuming app |
| `@tanstack/react-query` | ≥ 5.0 | Bundled — consuming app must have a `QueryClientProvider` |
| Zod | ≥ 4.0 | Bundled — used internally for response validation |
