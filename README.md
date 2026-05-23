# NestJS GraphQL Microservices

A production-ready NestJS monorepo demonstrating a federated GraphQL microservices architecture with JWT authentication, role-based access control (RBAC), and multi-tenancy.

Built to reflect patterns from real-world enterprise systems — the same architecture used at scale to serve multi-tenant SaaS platforms.

---

## Architecture

```
                          ┌─────────────────────────────────────────┐
                          │          Client (Browser / Mobile)      │
                          └──────────────────┬──────────────────────┘
                                             │  HTTP + Bearer token
                                             ▼
                          ┌─────────────────────────────────────────┐
                          │         Gateway  :3000  /graphql        │
                          │                                         │
                          │  ┌─────────────────────────────────┐    │
                          │  │   Apollo Federation Gateway     │    │
                          │  │   IntrospectAndCompose          │    │
                          │  │   Forwards Authorization header │    │
                          │  │   Forwards x-tenant-id header   │    │
                          │  └────────────┬────────────────────┘    │
                          └──────────────┬┼────────────────────────-┘
                                         ││
                      ┌──────────────────┘└───────────────────┐
                      ▼                                        ▼
       ┌──────────────────────────┐          ┌──────────────────────────────┐
       │   auth-service  :3001    │          │   users-service  :3002       │
       │                          │          │                              │
       │  Mutations:              │          │  Queries:                    │
       │   register               │          │   users (paginated)          │
       │   login                  │          │   user (by id)               │
       │   refreshTokens          │          │   me (current user)          │
       │   logout                 │          │                              │
       │                          │          │  Mutations:                  │
       │  JWT Strategy            │          │   createUser                 │
       │  bcrypt password hash    │          │   updateUser                 │
       │  Session management      │          │   deactivateUser             │
       │  Token rotation          │          │   activateUser               │
       │                          │          │   removeUser (soft-delete)   │
       └────────────┬─────────────┘          └──────────────┬───────────────┘
                    │                                        │
                    ▼                                        ▼
       ┌────────────────────────┐          ┌────────────────────────────────┐
       │   PostgreSQL auth_db   │          │   PostgreSQL users_db          │
       │   Table: sessions      │          │   Table: users                 │
       └────────────────────────┘          └────────────────────────────────┘
```

---

## Key Features

| Feature | Details |
|---|---|
| **GraphQL Federation v2** | Gateway stitches two subgraphs into a unified schema via `IntrospectAndCompose` |
| **JWT Authentication** | `auth-service` issues short-lived access tokens (15 min) + refresh tokens (30 days). Token rotation on refresh. |
| **RBAC** | `@Roles('admin', 'manager')` decorator + `RolesGuard` — hierarchy: `viewer < member < manager < admin < super_admin` |
| **Multi-tenancy** | Every entity has `tenantId`. All repository queries are scoped by `tenantId` at the service layer — data never leaks across tenant boundaries |
| **Audit Logging** | `AuditInterceptor` logs every mutation: `[AUDIT] user:<id> action:<op> tenant:<id> at <ISO> duration:<N>ms` |
| **Soft Deletes** | TypeORM `@DeleteDateColumn` — deleted records are hidden from normal queries but retained for audit trails |
| **Optimistic Locking** | `@VersionColumn` on User entity prevents stale concurrent writes |
| **Password Security** | bcrypt with configurable salt rounds; SHA-256 hashed refresh tokens stored in DB |

---

## Project Structure

```
nestjs-graphql-microservices/
├── apps/
│   ├── gateway/                    GraphQL Federation Gateway (port 3000)
│   │   └── src/
│   │       ├── app.module.ts       ApolloGateway + AuthenticatedDataSource
│   │       └── main.ts
│   │
│   ├── auth-service/               Auth subgraph (port 3001)
│   │   └── src/
│   │       ├── app.module.ts
│   │       ├── main.ts
│   │       └── auth/
│   │           ├── auth.module.ts
│   │           ├── auth.service.ts     login / register / refresh / logout
│   │           ├── auth.resolver.ts    GraphQL mutations
│   │           ├── strategies/
│   │           │   └── jwt.strategy.ts
│   │           ├── entities/
│   │           │   └── session.entity.ts
│   │           └── dto/
│   │               ├── login.input.ts
│   │               ├── register.input.ts
│   │               └── auth-response.type.ts
│   │
│   └── users-service/              Users subgraph (port 3002)
│       └── src/
│           ├── app.module.ts
│           ├── main.ts
│           └── users/
│               ├── users.module.ts
│               ├── users.service.ts    CRUD + RBAC + tenant scoping
│               ├── users.resolver.ts   GraphQL queries/mutations
│               ├── strategies/
│               │   └── jwt.strategy.ts
│               ├── entities/
│               │   └── user.entity.ts  tenantId, role, audit fields
│               └── dto/
│                   ├── create-user.input.ts
│                   ├── update-user.input.ts
│                   └── paginated-users.type.ts
│
├── libs/
│   └── common/                     Shared library (@app/common)
│       └── src/
│           ├── index.ts
│           ├── common.module.ts
│           ├── guards/
│           │   ├── jwt-auth.guard.ts   GraphQL-aware JwtAuthGuard
│           │   └── roles.guard.ts      @Roles() enforcement
│           ├── decorators/
│           │   ├── roles.decorator.ts      @Roles('admin', 'manager')
│           │   ├── current-user.decorator.ts   @CurrentUser()
│           │   └── public.decorator.ts         @Public()
│           └── audit/
│               └── audit.interceptor.ts  Structured mutation logging
│
├── docker-compose.yml          PostgreSQL x2 + pgAdmin
├── .env.example
├── package.json                NestJS monorepo
├── nest-cli.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker + Docker Compose

### 1. Clone and install

```bash
git clone https://github.com/msakithub/nestjs-graphql-microservices.git
cd nestjs-graphql-microservices
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET to a strong random string
```

### 3. Start databases

```bash
docker-compose up -d
# PostgreSQL auth_db  → localhost:5433
# PostgreSQL users_db → localhost:5434
# pgAdmin             → http://localhost:5050
```

### 4. Start all services

```bash
# All services in parallel (requires concurrently)
npm run start:dev

# Or start individually:
npm run start:auth     # auth-service  on :3001
npm run start:users    # users-service on :3002
npm run start:gateway  # gateway       on :3000
```

### 5. Open GraphQL Playground

```
http://localhost:3000/graphql
```

---

## Example GraphQL Operations

### Register a new user

```graphql
mutation Register {
  register(input: {
    firstName: "Abdullah"
    lastName: "Khan"
    email: "abdullah@msakithub.com"
    password: "Secure@Pass1"
  }) {
    accessToken
    refreshToken
    expiresIn
    tokenType
    userId
    tenantId
  }
}
```

### Login

```graphql
mutation Login {
  login(input: {
    email: "abdullah@msakithub.com"
    password: "Secure@Pass1"
  }) {
    accessToken
    refreshToken
    expiresIn
    tokenType
    userId
    tenantId
  }
}
```

### Get current user (requires Authorization header)

```graphql
# HTTP Header: Authorization: Bearer <accessToken>
query Me {
  me {
    id
    fullName
    email
    role
    tenantId
    isActive
    createdAt
  }
}
```

### List paginated users (manager+ only)

```graphql
# HTTP Header: Authorization: Bearer <accessToken>
query Users {
  usersPaginated(page: 1, limit: 10, search: "khan") {
    items {
      id
      fullName
      email
      role
      isActive
    }
    total
    page
    limit
    hasNextPage
  }
}
```

### Create a user (admin/manager only)

```graphql
# HTTP Header: Authorization: Bearer <admin-accessToken>
mutation CreateUser {
  createUser(input: {
    firstName: "Jane"
    lastName: "Doe"
    email: "jane@example.com"
    password: "Strong@Pass1"
    role: MEMBER
  }) {
    id
    fullName
    email
    role
    tenantId
    createdAt
  }
}
```

### Update a user

```graphql
mutation UpdateUser {
  updateUser(input: {
    id: "user-uuid-here"
    title: "Senior Engineer"
    displayName: "Jane D."
  }) {
    id
    fullName
    title
    displayName
    updatedAt
  }
}
```

### Soft-delete a user (admin only)

```graphql
mutation RemoveUser {
  removeUser(id: "user-uuid-here")
}
```

### Refresh access token

```graphql
mutation RefreshTokens {
  refreshTokens(refreshToken: "<your-refresh-token>") {
    accessToken
    refreshToken
    expiresIn
  }
}
```

### Logout

```graphql
# HTTP Header: Authorization: Bearer <accessToken>
mutation Logout {
  logout
}
```

---

## Audit Log Output

Every mutation produces a structured log line:

```
[AUDIT] user:550e8400-e29b-41d4-a716-446655440000 action:createUser tenant:6ba7b810-9dad-11d1-80b4-00c04fd430c8 at 2026-01-15T10:30:00.000Z duration:42ms
[AUDIT] user:550e8400-e29b-41d4-a716-446655440000 action:updateUser tenant:6ba7b810-9dad-11d1-80b4-00c04fd430c8 at 2026-01-15T10:30:05.000Z duration:18ms
[AUDIT] user:anonymous action:login tenant:anonymous at 2026-01-15T10:29:58.000Z duration:215ms
```

---

## Security Notes

- JWT secrets are loaded from environment variables — never hardcoded
- Refresh tokens are stored as SHA-256 hashes (never plaintext)
- All mutations on `users-service` require a valid JWT
- Role checks use a strict whitelist — unrecognized roles are denied
- Tenant isolation is enforced at the TypeORM query level, not just application logic
- Soft-deletes preserve audit history; hard-deletes require direct DB access
- Passwords use bcrypt with configurable salt rounds (default: 12)
- The `passwordHash` field is never included in GraphQL responses

---

## Built by

Abdullah Khan — [msakithub.com](https://msakithub.com)
