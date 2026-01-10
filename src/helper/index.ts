import {DateTime} from "luxon";

// Helper to determine allowed duration
export const getPeakLimit = (startTime: DateTime): number => {
    const hour = startTime.hour;

    // Define Peak Windows:
    // Lunch: 12:00 - 14:00
    // Dinner: 18:00 - 21:00
    const isPeak = (hour >= 12 && hour < 14) || (hour >= 18 && hour < 21);

    return isPeak ? 90 : 120; // 90 mins for peak, 120 mins for off-peak
};