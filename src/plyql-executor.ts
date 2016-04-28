import * as Q from 'q';
import { Timezone } from "chronoshift";
import { Expression, Datum, RefExpression, PlywoodValue, SQLParse } from "plywood";

function upperCaseRefs(expression: Expression): Expression {
  return expression.substitute((ex) => {
    if (ex instanceof RefExpression) {
      var v = ex.valueOf();
      v.name = v.name.toUpperCase();
      return new RefExpression(v);
    }
    return null;
  })
}

export function executeSQLParse(sqlParse: SQLParse, context: Datum, timezone: Timezone): Q.Promise<PlywoodValue> {
  var { expression, database } = sqlParse;
  if (database && database.toLowerCase() === 'information_schema') {
    expression = upperCaseRefs(expression);
  }
  
  return expression.compute(context, { timezone });
}
