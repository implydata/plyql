import * as Q from 'q';
import { Timezone } from "chronoshift";
import { Expression, Datum, RefExpression, PlywoodValue, Dataset, Set } from "plywood";
import { createJSONServer, JSONParameters } from './json-server';
import { executeSQLParse } from "./plyql-executor";

export function plyqlJSONServer(port: number, context: Datum, timezone: Timezone): void {

  createJSONServer(port, (parameters: JSONParameters, res: any) => {
    var { sql } = parameters;

    try {
      var sqlParse = Expression.parseSQL(sql);
    } catch (e) {
      res.status(400).send({ error: e.message });
      return;
    }

    if (sqlParse.verb && sqlParse.verb !== 'SELECT') { // DESCRIBE + SHOW get re-written
      res.status(400).send({ error: `Unsupported SQL verb ${sqlParse.verb} must be SELECT, DESCRIBE, SHOW, or a raw expression` });
    }

    executeSQLParse(sqlParse, context, timezone)
      .then((value: PlywoodValue) => {
        if (Dataset.isDataset(value)) {
          res.json({
            result: value.toJS()
          });
        } else {
          res.json({
            result: value
          });
        }
      })
      .done();
  });

}
