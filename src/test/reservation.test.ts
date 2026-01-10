import request from 'supertest';
import {app} from "../server";
import db from "../db";
import {restaurants} from "../schema/restaurant-schema";
import {tables} from "../schema/table-schema";

describe('Restaurant Reservation System', () => {
    let testRestaurantId: string;

    // Setup: Create a restaurant and a table before running tests
    beforeAll(async () => {
        // You might want to clear tables or use a transaction here
        const [restaurant] = await db.insert(restaurants).values({
            name: "Test Bistro",
            openingTime: "10:00",
            closingTime: "22:00"
        }).returning();

        testRestaurantId = restaurant.id;

        await db.insert(tables).values({
            restaurantId: testRestaurantId,
            tableNumber: 1,
            capacity: 4
        });
    });

    // TEST 1: PREVENT DOUBLE BOOKING
    it('should prevent double-booking the same table for overlapping times', async () => {
        const bookingData = {
            restaurantId: testRestaurantId,
            partySize: 2,
            startTimeISO: "2026-12-01T14:00:00Z",
            durationMinutes: 60,
            customerName: "Mahdi",
            customerPhone: "08108624958"
        };

        // First booking: 6:00 PM-7:00 PM
        await request(app).post('/api/v1/reservation').send(bookingData);

        // Second booking attempt: 6:30 PM-7:30 PM (Overlaps!)
        const response = await request(app)
            .post('/api/v1/reservation')
            .send({
                ...bookingData,
                customerName: "Bob",
                startTimeISO: "2026-06-01T18:30:00Z"
            });

        expect(response.status).toBe(400); // Or 409 Conflict
        expect(response.body.error).toMatch(/No tables available/i);
    });

    // TEST 2: CAPACITY VALIDATION
    it('should reject a reservation if party size exceeds table capacity', async () => {
        const response = await request(app)
            .post('/api/v1/reservation')
            .send({
                restaurantId: testRestaurantId,
                partySize: 10, // Capacity is only 4
                startTimeISO: "2026-06-01T12:00:00Z",
                durationMinutes: 60,
                customerName: "Big Group",
                customerPhone: "999999"
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/No tables available/i);
    });

    // TEST 3: OPERATING HOURS
    it('should reject reservations outside of operating hours', async () => {
        const response = await request(app)
            .post('/api/v1/reservation')
            .send({
                restaurantId: testRestaurantId,
                partySize: 2,
                startTimeISO: "2026-06-01T23:00:00Z", // Restaurant closes at 22:00
                durationMinutes: 60,
                customerName: "Late Night",
                customerPhone: "000000"
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/operating hours/i);
    });

    // TEST 4: AVAILABILITY CALCULATION
    it('should return available time slots for a specific date', async () => {
        const response = await request(app)
            .get('/api/v1/availability')
            .query({
                restaurantId: testRestaurantId,
                date: "2026-06-01",
                partySize: 2,
                duration: 60
            });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.availableSlots)).toBe(true);
        // Since we booked 18:00 in Test 1, 18:00 should NOT be in the available slots
        expect(response.body.availableSlots).not.toContain("18:00");
    });
});