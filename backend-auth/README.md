# Ecommerce Auth Module (Express + PostgreSQL + JWT)

Production-ready authentication module with:
- Register/Login
- bcrypt password hashing
- JWT auth (expires in 1 day)
- Auth middleware for protected routes
- Optional role-based access middleware

## Folder Structure

```text
backend-auth/
  src/
    config/
    controllers/
    middleware/
    routes/
    services/
    app.js
    server.js
  sql/
    schema.sql
  .env.example
  package.json
```

## Setup

1. Install dependencies:

```bash
cd backend-auth
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Run SQL schema in PostgreSQL:

```sql
\i sql/schema.sql
```

4. Start server:

```bash
npm run dev
```

## API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users/profile` (Bearer token required)
- `GET /api/users/admin-only` (Bearer token + `admin` role)
- `GET /health`

### Register Request

```json
{
  "email": "alice@example.com",
  "password": "StrongPass123",
  "name": "Alice"
}
```

### Login Request

```json
{
  "email": "alice@example.com",
  "password": "StrongPass123"
}
```

### Protected Route Example

Add header:

```text
Authorization: Bearer <jwt_token>
```
