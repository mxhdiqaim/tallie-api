import { redisClient } from "../config/redis-config";

// Clears all availability cache keys for a specific restaurant and date
export const invalidateAvailabilityCache = async (restaurantId: string, dateISO: string) => {
    try {
        // Find all keys for this restaurant on this date: availability:restId:date:*
        const pattern = `availability:${restaurantId}:${dateISO}:*`;
        const keys = await redisClient.keys(pattern);

        if (keys.length > 0) {
            await redisClient.del(keys);
            console.log(`🧹 Cache invalidated for restaurant ${restaurantId} on ${dateISO} (${keys.length} keys)`);
        }
    } catch (err) {
        console.error("Redis Cache Invalidation Error:", err);
    }
};