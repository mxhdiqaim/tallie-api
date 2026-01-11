# Tallie API Documentation

The Tallie API is a high-performance restaurant reservation system built with **Node.js**, **Express**, **Drizzle ORM**, and **Redis**. It features seating optimisation, waitlist management, peak-hour validation, and a Redis-backed availability cache.

## Setup instructions

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [PostgreSQL](https://www.postgresql.org/) database
- **Or** [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

### Docker SetupSetup instructions

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
   APP_URL=api.tallie.com
   
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
---

## API Docs

### Base URL

`http://localhost:5473/api/v1`

### System Health

`GET /health`

* **Description**: Checks if the API and database connections are healthy.
* **Response**: `200 OK`

---

## Availability

### Check Available Slots

`GET /availability/check`

* **Query Parameters**:
* `restaurantId` (String, Required): UUID of the restaurant.
* `partySize` (Number, Required): Number of guests.
* `date` (ISO String, Optional): The date to check (defaults to today).
* `duration` (Number, Optional): Minutes required (defaults to 60).


* **Features**: Utilises **Redis Caching** (5-minute TTL) for ultra-fast lookups.
* **Success Response**: `200 OK`
```json
{
  "date": "2026-01-11",
  "partySize": 2,
  "availableSlots": {
    "date": "2026-01-11",
    "slots": ["18:00", "18:30", "19:00"]
  }
}

```

## Reservations

### Create Reservation

`POST /reservations/create`

* **Body Parameters**:
```json
{
  "restaurantId": "uuid",
  "partySize": 4,
  "startTimeISO": "2026-01-11T19:00:00Z",
  "durationMinutes": 90,
  "customerName": "John Doe",
  "customerPhone": "1234567890",
  "allowWaitlist": true
}

```

* **Logic**:
* **Seating Optimisation**: Automatically assigns the smallest available table that fits the party size.
* **Waitlist**: If no tables are free and `allowWaitlist` is true, the user is added to the waitlist.
* **Cache Invalidation**: Automatically clears the Redis availability cache for that date.

### Update Reservation

`PATCH /reservations/:id`
* **Body Parameters**:
```json
{
   "partySize": 8,
   "startTimeISO": "2026-01-10T09:00:00Z",
   "durationMinutes": 120
}
```

* **Logic**:
* **Reassignment**: Attempts to reassign the reservation to a suitable table based on the new details.
* **Waitlist Handling**: If no suitable table is found, the reservation is moved to the waitlist.
* **Cache Invalidation**: Clears the Redis availability cache for both the old and new reservation dates.

* **Success Response**: `200 OK`
```json
{
   "id": "uuid",
   "restaurantId": "uuid",
   "tableId": "uuid",
   "customerName": "Mahdi Abubakar",
   "customerPhone": "8998277899",
   "partySize": 8,
   "startTime": "2026-01-10T09:00:00.000Z",
   "endTime": "2026-01-10T11:00:00.000Z",
   "reservationStatus": "confirmed",
   "createdAt": "2026-01-10T17:01:43.434Z",
   "lastModified": "2026-01-10T21:12:10.118Z"
}
```

### Cancel Reservation

`DELETE /reservations/:id`

* **Description**: Soft-cancels a reservation.
* **Logic**: Triggers the **Waitlist Promotion** engine. If a waitlisted guest fits the now-vacant table and time, they are automatically promoted to `confirmed` and notified.
* **Cache Invalidation**: Clears the Redis availability cache for that date.
* **Success Response**: `200 OK`
```json
{
   "message": "Cancelled and waitlist updated"
}
```

### Get Customer History

`GET /reservations/:phone`

* **Query Params**: `upcomingOnly=true` (optional).
* **Description**: Returns all reservations associated with a phone number.
* **Success Response**: `200 OK`
```json
[
   {
      "reservationId": "uuid",
      "startTime": "2026-01-15T09:00:00.000Z",
      "endTime": "2026-01-15T11:00:00.000Z",
      "partySize": 4,
      "restaurantName": "Chicken Republic"
   }
]
```

## Restaurants & Tables

### Get Restaurants
`GET /restaurants`

* **Description**: Returns a list of all restaurants.
* **Success Response**: `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Chicken Republic",
    "openingTime": "10:00:00",
    "closingTime": "22:00:00",
    "createdAt": "2026-01-11T08:25:51.888Z",
    "lastModified": "2026-01-11T08:25:51.888Z"
  }
]
```

### Create Restaurant

`POST /restaurants/create`

* **Body Parameters**: 
```json
{
   "name": "Chicken Republic",
   "openingTime": "10:00",
   "closingTime": "22:00"
}
```

* **Success Response**: `200 OK`
```json
{
  "id": "uuid",
  "name": "Chicken Republic",
  "openingTime": "10:00:00",
  "closingTime": "22:00:00",
  "createdAt": "2026-01-11T08:25:51.888Z",
  "lastModified": "2026-01-11T08:25:51.888Z"
}
```

### Add Table

`POST /restaurants/:id/add-table`

* **Body Parameters**:
```json
{ 
   "tableNumber": 10, 
   "capacity": 4
}
```
* **Validation**: Ensures `tableNumber` is unique within that specific restaurant.
* **Success Response**: `200 OK`
```json
{
   "id": "uuid",
   "restaurantId": "uuid",
   "tableNumber": 3,
   "capacity": 4,
   "createdAt": "2026-01-11T08:26:26.656Z",
   "lastModified": "2026-01-11T08:26:26.656Z"
}
```

### Get Tables

`POST /restaurants/:id/tables`

* **Description**: Returns all tables for a specific restaurant.
* **Success Response**: `200 OK`
```json
{
   "id": "uuid",
   "name": "Chicken Republic",
   "openingTime": "10:00:00",
   "closingTime": "22:00:00",
   "createdAt": "2026-01-11T00:23:13.694Z",
   "lastModified": "2026-01-11T00:23:13.694Z",
   "tables": [
      {
         "id": "uuid",
         "restaurantId": "uuid",
         "tableNumber": 10,
         "capacity": 1,
         "createdAt": "2026-01-11T00:23:34.428Z",
         "lastModified": "2026-01-11T00:23:34.428Z"
      }
   ]
}
```

### Restaurant Reservations

`GET /restaurants/:id/reservations?date=YYYY-MM-DD`

* **Description**: Returns all reservations for a specific day, sorted by status (Waitlist vs. Confirmed) and time.
* **Query Parameters**: `date` (ISO String, Optional).
* **Success Response**: `200 OK`
```json
[
   {
      "id": "954d926d-6042-4ae4-b72c-70b00dc46d4f",
      "customerName": "Waitlist Hopeful",
      "startTime": "2026-01-11T10:00:00.000Z",
      "partySize": 3,
      "tableNumber": 3,
      "capacity": 4
   }
]
```

## Technical Features

* **Caching**: Redis-based "Cache Aside" pattern for availability slots.
* **Rate Limiting**: Redis-backed global rate limiter (100 requests per minute per IP).
* **Seating Logic**: `asc(tables.capacity)` sorting ensures maximum restaurant yield.
* **Time Management**: Powered by **Luxon** for accurate timezone and overnight hours (e.g. 6 PM to 2 AM) handling.
* **Background Tasks**: `node-cron` monitors and updates reservation states automatically, it runs every 15min.
* **Error Handling**: Centralised middleware for consistent error responses.
