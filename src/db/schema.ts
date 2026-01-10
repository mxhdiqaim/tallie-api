import * as restaurants from "../schema/restaurant-schema";
import * as tables from "../schema/table-schema";

import * as restaurantsRelation from "../schema/relations/restaurant-relation";
import * as tablesRelation from "../schema/relations/table-relation";

const relations = {
    ...restaurantsRelation,
    ...tablesRelation
};

const schema = {
    ...restaurants,
    ...tables,

    ...relations
};

export default schema;
