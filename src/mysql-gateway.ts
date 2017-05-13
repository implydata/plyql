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

import * as moment from 'moment-timezone';
import { Timezone } from 'chronoshift';
import { Dataset, PlyType } from "plywood";
import * as mysql from 'vogievetsky-mysql2';
const TYPES: Record<string, number> = require('vogievetsky-mysql2/lib/constants/types');
const CHARSETS: Record<string, number> = require('vogievetsky-mysql2/lib/constants/charsets');
const CLIENT: Record<string, number> = require('vogievetsky-mysql2/lib/constants/client');

const capabilityFlags = 0
  | CLIENT['LONG_PASSWORD']           /* new more secure passwords */
  | CLIENT['FOUND_ROWS']              /* found instead of affected rows */
  | CLIENT['LONG_FLAG']               /* get all column flags */
  | CLIENT['CONNECT_WITH_DB']         /* one can specify db on connect */
  | CLIENT['NO_SCHEMA']               /* don't allow database.table.column */
  //| CLIENT['COMPRESS']                /* can use compression protocol */
  | CLIENT['ODBC']                    /* odbc client */
  | CLIENT['LOCAL_FILES']             /* can use LOAD DATA LOCAL */
  | CLIENT['IGNORE_SPACE']            /* ignore spaces before '' */
  | CLIENT['PROTOCOL_41']             /* new 4.1 protocol */
  | CLIENT['INTERACTIVE']             /* this is an interactive client */
  //| CLIENT['SSL']                     /* switch to ssl after handshake */
  | CLIENT['IGNORE_SIGPIPE']          /* IGNORE sigpipes */
  | CLIENT['TRANSACTIONS']            /* client knows about transactions */
  | CLIENT['RESERVED']                /* old flag for 4.1 protocol  */
  | CLIENT['SECURE_CONNECTION']       /* new 4.1 authentication */
  //| CLIENT['MULTI_STATEMENTS']        /* enable/disable multi-stmt support */
  //| CLIENT['MULTI_RESULTS']           /* enable/disable multi-results */
  //| CLIENT['PS_MULTI_RESULTS']        /* multi-results in ps-protocol */
  | CLIENT['PLUGIN_AUTH']             /* client supports plugin authentication */
  | CLIENT['SSL_VERIFY_SERVER_CERT']
  //| CLIENT['REMEMBER_OPTIONS']
  ;

export function dateToSQL(d: Date, timezone: Timezone): string {
  return moment.tz(d, timezone.toString()).format('YYYY-MM-DD HH:mm:ss')
}

export function plywoodTypeToMySQL(type: PlyType) {
  switch (type) {
    case 'NULL': return TYPES['VAR_STRING'];
    case 'BOOLEAN': return TYPES['TINY'];
    case 'STRING':
    case 'SET/STRING': return TYPES['VAR_STRING'];
    case 'NUMBER': return TYPES['DOUBLE'];
    case 'NUMBER_RANGE': return TYPES['DOUBLE'];
    case 'TIME': return TYPES['TIMESTAMP'];
    case 'TIME_RANGE': return TYPES['TIMESTAMP'];
    default: throw new Error(`unsupported type ${type}`);
  }
}

export function columnToMySQL(column: any, table: string) {
  table = table || '';
  return {
    catalog: 'def',
    schema: '', // DB name
    name: column.name,
    orgName: column.name,
    table: table,
    orgTable: table,
    characterSet: CHARSETS['UTF8MB4_UNICODE_CI'],
    columnLength: 500,
    columnType: plywoodTypeToMySQL(column.type),
    flags: 32896,
    decimals: 0
  }
}

export interface MySQLParameters {
  sql: string;
  connectionId: number;
}

export interface MySQLQueryProcessor {
  (parameters: MySQLParameters, conn: any): void;
}

export function createMySQLGateway(port: number, queryProcessor: MySQLQueryProcessor) {
  let server = mysql.createServer();
  server.listen(port);
  console.log(`MySQL Gateway listening on port: ${port}`);
  console.log(`you can connect to it using \`mysql --host=127.0.0.1 --port=${port}\``);

  let connectionId = 0;
  server.on('connection', function(conn) {
    connectionId++;
    console.log(`New connection ${connectionId}`);

    conn.serverHandshake({
      protocolVersion: 10,
      serverVersion: '5.7.11',
      connectionId,
      statusFlags: 2,
      characterSet: CHARSETS['UTF8MB4_UNICODE_CI'],
      capabilityFlags
    });

    conn.on('query', (sql) => {
      console.log(`[${connectionId}] Got SQL: ${sql}`);

      queryProcessor({ sql, connectionId }, conn);
    });

    conn.on('error', (err) => {
      console.log(`[${connectionId}] Error: ${err.message}`);
    })
  });
}

export function fallbackMySQLFactory(connectionUri: string) {
  let remote = mysql.createConnection(connectionUri);
  remote.query('select 1 as one', (err, res) => {
    if (err) {
      console.log('Connection to real MySQL fail');
      process.exit(1);
    } else {
      console.log('Connection to real MySQL success');
    }
  });

  return function (sql: string, conn: any) {
    remote.query(sql, function(err: Error, rows: any[], columns: any[]) {
      // overloaded args, either (err, result :object)
      // or (err, rows :array, columns :array)

      if (err) {
        console.log('GOT ERROR', (err as any).code, err.message);
        conn.writeError({ code: 1149, message: 'Bad query' });
        return
      }

      if (!Array.isArray(rows)) {
        // response to an 'insert', 'update' or 'delete'
        console.log('other result', rows);
        conn.writeOk(rows);
        return
      }

      // response to a 'select', 'show' or similar
      console.log('columns', columns.map((d: any) => `${d.name}(${d.columnType})`));
      console.log('columns', columns);
      let n = Math.min(5, rows.length);
      for (let i = 0; i < n; i++) {
        console.log(rows[i]);
      }
      if (n < rows.length) {
        console.log('... ' + String(rows.length - n));
      }

      conn.writeTextResult(rows, columns);
    });
  }
}
