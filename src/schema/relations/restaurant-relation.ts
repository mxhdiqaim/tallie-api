import {relations} from "drizzle-orm";
import {restaurants} from "../restaurant-schema";
import {tables} from "../table-schema";

// Define Relations (Optional but helpful for querying)
export const restaurantRelations = relations(restaurants, ({ many }) => ({
    tables: many(tables),
}));