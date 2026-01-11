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

## Design decisions and assumptions

[//]: # (* **Soft Deletes**: Reservations are soft-deleted to maintain historical data integrity.)

[//]: # (* **Waitlist Promotion**: Automatically promotes waitlisted reservations when cancellations occur.)

[//]: # (* **Table Uniqueness**: Table numbers are unique per restaurant to avoid conflicts.)

[//]: # (* **Optimistic Seating**: The system optimistically assigns tables to maximise seating efficiency.)

[//]: # (* **Scalability**: Designed to handle high traffic with efficient caching and rate limiting.)

[//]: # (* **Extensibility**: Modular architecture allows for the easy addition of new features in the future.)

[//]: # (* **Security**: Basic input validation is implemented. However, further security measures &#40;e.g. authentication, authorisation&#41; should be considered for production use.)

---

### 1. Yield Management & Seating Optimisation

**Decision:** The system implements a "Smallest-Fit First" algorithm using database-level sorting (`ORDER BY capacity ASC`).

* **Assumption:** Restaurants want to preserve large tables for large parties to maximise revenue.
* **Logic:** If a party of 2 requests a table, the system will bypass an available 8-seater to check if any 2-seaters are open. It only uses the 8-seater for the small party if it is the *only* option left.
* **Benefit:** This prevents "fragmentation" of the dining room where large groups are turned away despite the restaurant being half-empty.

---

### 2. The Cache Strategy with Redis

**Decision:** Availability checks are cached in Redis with a 5-minute TTL, but invalidated immediately on state changes.

* **Assumption:** Users check availability far more often than they actually book. Availability calculation is "expensive" (involving multiple table joins and time-overlap math).
* **Logic:** When a booking is created or cancelled, we trigger a "Cache Eviction" for that specific restaurant and date.
* **Benefit:** This ensures that the search results are lightning-fast for 99% of users while maintaining "Strong Consistency" (users won't see a slot as available if it was just booked seconds ago).

---

### 3. Timezone and Operating Hours Handling

**Decision:** All time calculations are handled via **Luxon** using ISO 8601 strings, with support for "Overnight Logic."

* **Assumption:** Restaurants don't always close at midnight. Many stay open until 1:00 AM or 2:00 AM.
* **Logic:** If `closingTime` (e.g., 02:00) is numerically less than `openingTime` (e.g., 18:00), the system assumes the closing time belongs to the *next* calendar day.
* **Assumption:** The `startTimeISO` provided by the client includes the correct offset or is in UTC.

---

### 4. Waitlist Promotion Engine

**Decision:** Promotion from the waitlist is handled as a "Side Effect" of cancellation.

* **Assumption:** A "First-Come, First-Served" (FCFS) model is the fairest for customers.
* **Logic:** When a cancellation occurs, the system specifically looks for waitlisted entries that "fit" into the exact time slot and table capacity that was just vacated.
* **Benefit:** This automates the work for restaurant hosts, ensuring the table is filled immediately without manual intervention.
* **Future Consideration:** We can implement a cronjob that periodically scans the waitlist to find "gaps" in the schedule that can be filled, but this is outside the scope of the current version.

---

### 5. Peak Hour Constraints

**Decision:** Dynamic duration limits based on the time of day.

* **Assumption:** Tables are more valuable during "Prime Time" (e.g., 7:00 PM - 9:00 PM).
* **Logic:** The `getPeakLimit` utility caps how long a user can stay during high-traffic windows (90 min).
* **Benefit:** This allows the restaurant to "turn" the table more times in one night, increasing total covers.

---

### 6. Relational Database Choice (PostgreSQL)

**Decision:** Use of **PostgreSQL** with **Drizzle ORM** instead of NoSQL.

* **Assumption:** Data integrity and ACID compliance are non-negotiable for bookings.
* **Logic:** Double-booking is a "hard failure" in the hospitality industry. Relational constraints and transaction-safe updates ensure that a table cannot be assigned to two people at once, even if two requests hit the server at the exact same millisecond.

---

### 7. Assumptions on Table "Flexibility"

* **Fixed Tables:** I assume tables are stationary. The current version does not support "Table Joining" (merging two 2-seaters to make a 4-seater) unless explicitly defined as a unique "Table" in the database.
* **No Manual Overrides:** We assume the system has total authority over availability. (In a future version, a "Manager Override" might bypass these rules).

## Known limitations

### 1. No Table Combining (Static Inventory)

The system treats every table as a fixed entity.

* **The Problem:** If you have two vacant 2-seater tables, the system cannot "merge" them to accommodate a party of 4.
* **Impact:** You might turn away a larger party even if you have the physical floor space to accommodate them by moving furniture.
* **Workaround:** Managers must manually define "Combos" as separate table entries in the database.

---

### 2. Lack of "Shuffling" Optimisation

The seating algorithm is "Greedy" it picks the best available table at the moment the request is made.

* **The Problem:** It doesn't look at the "Tetris" of the whole night. For example, it might assign a party of 2 to a 2-seater that is needed for a confirmed booking 30 minutes later, even if another 2-seater was free for the whole night.
* **Impact:** This can lead to "Swiss Cheese" availability, where you have many small gaps that are too short for a full reservation.

---

### 3. Redis `KEYS` Command Performance

In the `invalidateAvailabilityCache` helper, we use the Redis `KEYS` command to find keys to delete.

* **The Problem:** The `KEYS` command can block the Redis event loop if the database contains millions of keys.
* **Impact:** In a massive multi-restaurant setup, this could cause temporary latency spikes.
* **Solution for Scale:** In a high-volume production environment, this should be refactored to use `SCAN` or a dedicated "Sets" approach to track keys by restaurant.

---

### 4. Simplified "Overnight" Support

While the system handles hours like 6:00 PM to 2:00 AM, it assumes a reservation stays within a single "business day" logic.

* **The Problem:** It does not currently support multi-day bookings (e.g. a hotel-style stay) or complex split shifts (opening 12–3 PM, closing, then reopening 6–11 PM).
* **Impact:** Restaurants with midday closures would need a more complex `operatingHours` schema.

---

### 5. Race Conditions in Waitlist Promotion

The promotion logic is triggered *after* a cancellation.

* **The Problem:** If two people cancel at the exact same millisecond, there is a theoretical window where the same waitlisted guest could be processed twice or a race condition could occur during table assignment.
* **Impact:** Extremely rare in low-to-mid traffic, but requires database **Transactions** or **Row Level Locking** (`SELECT ... FOR UPDATE`) to be 100% bulletproof at scale.

---

### 6. No Real-Time "Heartbeat" for Pending Bookings

The current `ReservationStatusEnum.PENDING` relies on a Cron job to clean up.

* **The Problem:** If a user starts a booking but never finishes, that table is "locked" until the next Cron cycle runs (usually every 10–15 minutes).
* **Impact:** Other users might see the table as unavailable for a few minutes even though the first user has already abandoned their browser tab or closed the mobile application.
* **Solution for Scale:** Implement a WebSocket or polling-based system to keep the reservation alive only while the user is actively engaged.

---

### 7. Global Peak Hour Rules

Currently, `getPeakLimit` is a global utility.

* **The Problem:** Every restaurant in the system follows the same peak hour definition.
* **Impact:** A breakfast café has different peak hours than a late-night cocktail bar. The logic should eventually be moved into the `restaurants` table as a configuration.
* **Solution for Scale:** Add `peakStartTime`, `peakEndTime`, and `peakDurationLimit` fields to the `restaurants` table.

## What you would improve with more time

### 1. Intelligent "Tetris" Seating (Global Optimisation)

Currently, the seating has "first-come, first-served." I would implement a **Constraint Satisfaction Solver**.

* **The Improvement:** Instead of just picking the first available table, the system would simulate different seating arrangements for the whole night.
* **The Goal:** To minimise "un-bookable" gaps. For example, if moving a 7:00 PM booking from Table 1 to Table 2 opens up a 4-hour block for a large party, the system should suggest that "shuffle" to the manager.

---

### 2. Table Combining Logic (Dynamic Inventory)

I would move away from "Static Tables" and introduce **Adjacency Mapping**.

* **The Improvement:** Define which tables are physically next to each other in the database.
* **The Logic:** If a party of 4 arrives and no 4-seater is open, the system would check if `Table 1 (Cap 2)` and `Table 2 (Cap 2)` are both free and adjacent. If so, it would "virtually merge" them for that reservation.

---

### 3. Machine Learning for "No-Show" Prediction

Not all reservations are equal. Some customers have a history of not showing up.

* **The Improvement:** Use historical data to assign a "Reliability Score" to customers.
* **The Logic:** If a "Low Reliability" customer books a prime-time slot, the system could **Overbook** by a small percentage (similar to airlines) or require a non-refundable deposit.

---

### 4. Granular Restaurant Configuration (The Multi-Tenant Upgrade)

Currently, peak hours and duration limits are somewhat global.

* **The Improvement:** Move all business rules into a JSONB configuration column in the `restaurants` table.
* **The Logic:** Allow a Breakfast Café to define peak hours as (8:00 AM - 10:00 AM) and a Nightclub to define them as (11:00 PM - 2:00 AM), with different duration limits for each.

---

### 5. Advanced Redis Caching (Bloom Filters)

As the number of restaurants grows, checking Redis for "No Availability" can become slow.

* **The Improvement:** Implement **Redis Bloom Filters**.
* **The Logic:** Before even hitting the database or the standard cache, a Bloom Filter can tell the system with 100% certainty if a restaurant has *zero* tables available for a certain day. This saves thousands of unnecessary database hits during holiday surges.

---

### 6. Real-Time "Live Map" via WebSockets

Static lists are great for APIs, but restaurant managers need a visual.

* **The Improvement:** Integrate **Socket.io**.
* **The Logic:** Create a real-time floor plan where tables change colour (Green to Red) the moment a reservation starts, a customer is seated, or a table becomes "Dirty" and needs clearing.

---

### 7. Multi-Phase Waitlist (Pre-emptive Promotion)

Our current waitlist only promotes when someone cancels.

* **The Improvement:** Implement "Predicted Availability."
* **The Logic:** If a table is due to leave in 15 minutes, the system could text the next person on the waitlist: *"Your table will likely be ready in 15 minutes, please head toward the restaurant."* This reduces "Dead Table Time" between seating.

---

## Scaling to Enterprise Level

### 1. Database Scaling: Multi-Tenancy

As we add thousands of restaurants, a single database table for reservations will eventually become a bottleneck.

* **The Strategy:** Implement **Database Sharding** or **Partitioning**.
* **The Logic:** Use **PostgreSQL Table Partitioning** based on `restaurantId`. This allows the database to ignore millions of rows belonging to other restaurants and only scan the data relevant to the specific restaurant being queried.
* **Assumption:** Data is geographically concentrated. We could shard by region (e.g., `africa-south-db`, `eu-west-db`) to keep data close to the physical restaurant for lower latency.

---

### 2. Intelligent Caching: The Global vs. Local Split

A global Redis instance will eventually run out of memory or hit connection limits.

* **The Strategy:** **Distributed Redis Clusters**.
* **The Logic:** Use a "Sidecar" cache approach. Each region has its own Redis cluster.
* **Advanced Optimisation:** Use **Redis Bloom Filters** for availability. A Bloom Filter can tell the system *immediately* if a restaurant is fully booked for a specific date without performing a complex query or even a standard cache lookup. This is incredibly efficient for "Search as you type" features.

---

### 3. Compute Scaling: Microservices & Event-Driven Logic

Currently, the API handles everything (Auth, Reservations, Notifications, Cron). This should be broken down.

* **The Strategy:** **Event Sourcing with Message Queues (RabbitMQ/Kafka)**.
* **The Logic:** When a user clicks "Book", the API simply drops a message into a queue.
* **Reservation Worker**: Picks up the message and handles the DB logic.
* **Notification Worker**: Handles the Email/SMS API (so the user doesn't wait or SMS for the email to send before getting a "Success" screen).
* **Analytics Worker**: Updates the restaurant's daily reports.
* **Benefit:** If the Notification service goes down, people can still book tables. The system becomes "Fault Tolerant."

---

### 4. Search Scaling: Dedicated Search Engine

SQL `WHERE` clauses are not meant for "Discovery" (e.g. "Find me Chicken Republic restaurants near me with a table for 4 at 7 PM").

* **The Strategy:** **Elasticsearch or Meilisearch integration**.
* **The Logic:** Sync your restaurant and table availability to an indexed search engine.
* **The Benefit:** Elasticsearch is designed for high speed filtering across multiple dimensions (price, location, availability) simultaneously, which is much faster than standard SQL for discovery-based queries.

---

### Summary of Scaling Evolution

| Component | Current (Small Scale) | Enterprise (Large Scale)                    |
| --- | --- |---------------------------------------------|
| **Database** | Single Postgres Instance | Partitioned/Sharded Postgres                |
| **Caching** | Local Redis | Distributed Redis Cluster + Bloom Filters   |
| **Logic** | Monolith API | Microservices (Booking, Auth, Notification) |
| **Notifications** | In-process (Async) | Event-driven (Kafka/RabbitMQ)               |
| **Cron Jobs** | `node-cron` in-app | Distributed Cron (e.g., BullMQ or Temporal) |