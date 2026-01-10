import { Response } from "express";
import {CustomRequest} from "../types/express";
import {getAvailableSlots} from "../service/availability-service";
import {StatusCodes} from "http-status-codes";
import {handleError} from "../service/error-handling";

/*
    * @description Check table availability for a given restaurant, date, and party size
    * @route GET /api/v1/availability/check
    * @query restaurantId - ID of the restaurant
    * @query date - Date to check (ISO string)
    * @query partySize - Number of people
    * @query duration - Duration of the reservation in minutes (optional, default 60)
*/
export const checkAvailability = async (req: CustomRequest, res: Response) => {
    try {
        const { restaurantId, date, partySize, duration } = req.query;

        if (!restaurantId || !date || !partySize) {
            return handleError(res, "Missing parameters", StatusCodes.BAD_REQUEST);
        }

        const slots = await getAvailableSlots(
            restaurantId as string,
            date as string,
            parseInt(partySize as string),
            parseInt(duration as string || "60") // Default to 1 hour
        );

        res.json({ date, partySize, availableSlots: slots });
    } catch (error) {
        handleError(res, "Could not calculate availability", StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
};