import { Response, Request } from "express";
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
export const checkAvailability = async (req: Request, res: Response) => {
    try {
        const { restaurantId, date, partySize, duration } = req.query;

        if (!restaurantId || !partySize) {
            return handleError(res, "Missing parameters", StatusCodes.BAD_REQUEST);
        }

        const result = await getAvailableSlots(
            restaurantId as string,
            Number(partySize),
            Number(duration),
            date as string // Works if undefined
        );
        res.json({ date, partySize, availableSlots: result });
    } catch (error) {
        handleError(res, "Could not calculate availability", StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
};