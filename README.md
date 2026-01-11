# Tallie API

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [PostgreSQL](https://www.postgresql.org/) database
- **Or** [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

### Docker Setup

For a quick and isolated development environment, you can use Docker.

1. **Configure Environment Variables:**
   Create a `.env` file from `.env.example`. The `docker-compose.yml` file will use a service-based hostname to connect
   to the PostgreSQL container.

   ```bash
   NODE_ENV=development
PORT=5473
    
    DB_HOST=postgres_db
    DB_PORT=some_port
    DB_USER=some_user
    DB_PASSWORD=some_password
    DB_NAME=some_db
    
    ## Other local env variables
    APP_URL=app.tallie.com
    
    # Redis
    REDIS_HOST=redis_cache
    REDIS_PORT=6379
    REDIS_PASSWORD=some_redis_password
    REDIS_URL=redis://:some_redis_password@redis_cache:6379/0
   ```

2. **Build and Run the Containers:**
   This will build the API image and start both the API and the PostgreSQL database containers.

   ```bash
   docker compose up --build -d
   ```

3. **(Optional) Seed the Database:**
   If you have seeding uncommented in your `entrypoint.dev.sh` script, it will also run automatically. Otherwise, you
   can execute it manually.

   ```bash
   docker compose exec api pnpm run seed
   ```

4. **Access the API:**
   The API will be available at `http://localhost:{PORT}` (or your configured port).

### Installation (Manual)

If you're not using Docker, follow these steps.

1. **Installation:**

   ```bash
   pnpm install
   ```

2. **Database Setup:**
1. Create a PostgreSQL database.
2. Configure your environment variables in a `.env` file (see `.env.example` if available).

    ```bash
    NODE_ENV=development
    PORT=5473
    
    DB_HOST=postgres_db
    DB_PORT=some_port
    DB_USER=some_user
    DB_PASSWORD=some_password
    DB_NAME=some_db
    
    ## Other local env variables
    APP_URL=app.tallie.com
    
    # Redis
    REDIS_HOST=redis_cache
    REDIS_PORT=6379
    REDIS_PASSWORD=some_redis_password
    REDIS_URL=redis://:some_redis_password@redis_cache:6379/0
    ```

3. Generate Migrations:

    ```bash
    pnpm run generate
    ```

4. Run migrations:

    ```bash
    pnpm run migrate
    ```

5. (Optional) Seed the database with an initial manager:

    ```bash
    pnpm run seed
    ```

### Running the Server

```bash
pnpm dev
```

The API will be available at `http://localhost:{PORT}` (or your configured port).

---

## API Overview

### Authentication

- `POST /api/register` — Register a new manager and store
- `POST /api/login` — Login and receive a JWT
- `POST /api/logout` — Logout (JWT required)

### Users

- `GET /users` — List users (Manager/Admin)
- `POST /users/create` — Create user (Manager/Admin)
- `PATCH /users/:id` — Update user
- `DELETE /users/:id` — Delete user (soft delete)
- `PATCH /users/update-password` — Change password

### Stores

- `GET /stores` — List stores/branches
- `POST /stores` — Create branch
- `PATCH /stores/:id` — Update store
- `DELETE /stores/:id` — Delete store

### Menu Items/Products

- `GET /menu-items` — List menu items
- `POST /menu-items/create` — Add menu item
- `PATCH /menu-items/:id` — Update menu item
- `DELETE /menu-items/:id` — Delete menu item

### Orders

- `GET /orders` — List orders
- `POST /orders/create` — Create order
- `PATCH /orders/:id` — Update order status
- `DELETE /orders/:id` — Delete order

### Activity Log

- `GET /activities` — View activity log (Manager: all, Admin: non-manager actions)

---

## Development Notes

- **Rate Limiting:** Configured globally to prevent abuse (see `src/server.ts`).
- **Activity Logging:** All critical actions are logged automatically (see `src/service/activity-logger.ts`).
- **Multi-Tenancy:** All queries are scoped by `storeId` for data isolation.

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
