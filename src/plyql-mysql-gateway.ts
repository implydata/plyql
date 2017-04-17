/*
 * Copyright 2015-2017 Imply Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Timezone } from "chronoshift";
import {Expression, Datum, PlywoodValue, Dataset, Set, SQLParse, TimeRange} from "plywood";
import { getVariablesFlatDataset } from './variables';
import { columnToMySQL, dateToSQL, createMySQLGateway, fallbackMySQLFactory, MySQLParameters } from './mysql-gateway';
import { executeSQLParse } from "./plyql-executor";

function printError(sql: string, err: Error): void {
  console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  console.log('Failed to resolve query with Plywood.');
  console.log('Query:');
  console.log(sql);
  console.log('If you believe this query should work please create an issue on PlyQL and include this section');
  console.log('Issue url: https://github.com/implydata/plyql/issues');
  console.log('Message:');
  console.log(err.message);
  console.log('Stack:');
  console.log((err as any).stack);
  console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
}

function datumToMySQLRow(row: Datum, timezone: Timezone) {
  let newRow: any = {};
  for (let k in row) {
    let v = row[k];

    // Kill ranges
    if (v && (v as any).start) v = (v as any).start;

    if (v && (v as any).toISOString) {
      v = dateToSQL(v as Date, timezone);
    } else if (Set.isSet(v) || TimeRange.isTimeRange(v)) {
      v = v.toString(timezone); // plyql does not yet support set times though
    } else if (typeof v === 'boolean') {
      v = Number(v);
    }
    newRow[k] = v;
  }
  return newRow;
}

export function plyqlMySQLGateway(port: number, context: Datum, timezone: Timezone, fallbackURI: string): void {
  // fallbackURI is something like 'mysql://root:@192.168.99.100/plywood_test';

  //let fallbackMySQL = fallbackURI ? fallbackMySQLFactory(fallbackURI) : null;

  createMySQLGateway(port, (parameters: MySQLParameters, conn: any): void => {
    let { sql, connectionId } = parameters;

    let myContext = context;
    let match: string[];

    // Deal with "SELECT @@blah LIMIT 1" by de-sugaring
    if ((/SELECT\s+@@/i).test(sql)) {
      sql = sql.replace(/@@(?:global\.|session\.)?/g, '');
      myContext = {
        data: getVariablesFlatDataset()
      }
    }

    // Hack, treat USE `blah` as SET ... (ignores it)
    if (match = sql.match(/USE\s+`/i)) {
      sql = "SET NAMES 'utf8'";
    }

    // Handle connection id query
    if (match = sql.match(/SELECT\s+(CONNECTION_ID\(\s*\))/i)) {
      let name = match[1];
      let row: any = {};
      row[name] = connectionId;
      conn.writeTextResult([row], [
        {
          catalog: 'def',
          schema: '', // DB name
          name: 'CONNECTION_ID()',
          orgName: 'CONNECTION_ID()',
          table: '',
          orgTable: '',
          characterSet: 33, // UTF8_GENERAL_CI
          columnLength: 500,
          columnType: 0x8,
          flags: 32896,
          decimals: 0
        }
      ]);
      return;
    }

    let sqlParse: SQLParse;
    try {
      sqlParse = Expression.parseSQL(sql);
    } catch (e) {
      printError(sql, e);
      conn.writeError({
        code: 1064, // You have an error in your SQL syntax
        message: e.message
      });
      return;
    }

    if (!sqlParse.verb) {
      conn.writeError({
        code: 1064,
        message: `Must have a verb`
      });
      return;
    }

    switch (sqlParse.verb) {
      case 'SET':
        conn.writeOk();
        return;

      case 'SELECT':
        executeSQLParse(sqlParse, myContext, timezone)
          .then((dataset: PlywoodValue) => {
            if (Dataset.isDataset(dataset)) {
              let flatDataset = dataset.flatten();
              let plyColumns = flatDataset.attributes.map(c => columnToMySQL(c, sqlParse.table));
              let plyRows = flatDataset.data.map((d) => datumToMySQLRow(d, timezone));
              conn.writeTextResult(plyRows, plyColumns);
            } else {
              throw new Error('unexpected result from expression');
            }
          });
        return;

      default:
        conn.writeError({
          code: 1337,
          message: `Permission to ${sqlParse.verb} denied`
        });
        return;
    }

  });

}
