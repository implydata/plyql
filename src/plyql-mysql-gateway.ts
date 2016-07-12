/*
 * Copyright 2015-2016 Imply Data, Inc.
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

import * as Q from 'q';
import { Timezone } from "chronoshift";
import { Expression, Datum, RefExpression, PlywoodValue, Dataset, Set } from "plywood";
import { getVariablesFlatDataset } from './variables';
import { columnToMySQL, MySQLResult, dateToSQL, createMySQLGateway, fallbackMySQLFactory, MySQLParameters } from './mysql-gateway';
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

export function plyqlMySQLGateway(port: number, context: Datum, timezone: Timezone, fallbackURI: string): void {
  // fallbackURI is something like 'mysql://root:@192.168.99.100/plywood_test';

  var fallbackMySQL = fallbackURI ? fallbackMySQLFactory(fallbackURI) : null;

  createMySQLGateway(port, (parameters: MySQLParameters, conn: any): void => {
    var { sql, connectionId } = parameters;
    Q.fcall(() => {
      var myContext = context;
      var match: string[];

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
        return {
          type: 'connectionId',
          name: match[1]
        }
      }

      try {
        var sqlParse = Expression.parseSQL(sql);
      } catch (e) {
        printError(sql, e);
        return {
          type: 'error',
          code: 1064, // You have an error in your SQL syntax
          message: e.message
        };
      }

      if (!sqlParse.verb) {
        return {
          type: 'error',
          code: 1064,
          message: `Must have a verb`
        };
      }

      switch (sqlParse.verb) {
        case 'SET':
          return {
            type: 'ok'
          };

        case 'SELECT':
          return executeSQLParse(sqlParse, myContext, timezone)
            .then((dataset: PlywoodValue): MySQLResult => {
              if (Dataset.isDataset(dataset)) {
                return {
                  type: 'dataset',
                  dataset,
                  table: sqlParse.table
                };
              } else {
                throw new Error('unexpected result from expression');
              }
            });

        default:
          return {
            type: 'error',
            code: 1337,
            message: `Permission to ${sqlParse.verb} denied`
          };
      }
    })
    .then((result: MySQLResult): any => {
      switch (result.type) {
        case 'ok':
          conn.writeOk();
          break;

        case 'error':
          conn.writeError({ code: result.code, message: result.message });
          break;

        case 'dataset':
          var dataset = result.dataset;
          var plyColumns = dataset.getColumns().map(c => columnToMySQL(c, result.table));
          var plyRows = dataset.flatten().map(row => {
            var newRow: any = {};
            for (var k in row) {
              var v = row[k];

              // Kill ranges
              if (v && v.start) v = v.start;

              if (v && v.toISOString) {
                v = dateToSQL(v);
              } else if (Set.isSet(v)) {
                v = v.toString();
              } else if (typeof v === 'boolean') {
                v = Number(v);
              }
              newRow[k] = v;
            }
            return newRow;
          });
          conn.writeTextResult(plyRows, plyColumns);
          break;

        case 'connectionId':
          var name = result.name;
          var row: any = {};
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
          break;

        default:
          throw new Error(`unexpected result ${result.type}`);
      }
    })
    .catch((err: Error) => {
      printError(sql, err);

      if (fallbackMySQL) {
        fallbackMySQL(sql, conn);
      } else {
        conn.writeError({ code: 1337, message: 'Something broke' });
      }
    })
    .done();
  });

}
