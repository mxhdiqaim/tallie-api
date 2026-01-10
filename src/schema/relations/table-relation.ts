import {relations} from "drizzle-orm";
import {restaurants} from "../restaurant-schema";
import {tables} from "../table-schema";

export const tableRelations = relations(tables, ({ one }) => ({
    restaurant: one(restaurants, {
        fields: [tables.restaurantId],
        references: [restaurants.id],
    }),
}));