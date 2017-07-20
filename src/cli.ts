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

import * as fs from 'fs';
import * as path from 'path';
import * as hasOwnProp from 'has-own-prop';
import * as nopt from 'nopt';
import { WritableStream } from 'readable-stream';

import { Timezone, parseInterval, isDate } from 'chronoshift';

import { $, Expression, Datum, Dataset, PlywoodValue, TimeRange,
  External, DruidExternal, AttributeJSs, SQLParse, version, Set } from 'plywood';

import { properDruidRequesterFactory } from './requester';
import { executeSQLParseStream } from './plyql-executor';
import { getOutputTransform } from './output-transform';

import { getVariablesDataset } from './variables';
import { getStatusDataset } from './status';
import { addExternal, getTablesDataset, getColumnsDataset, getSchemataDataset } from './schema';
import {
  getCharacterSetsDataset, getCollationsDataset, getKeyColumnUsageDataset, getIndexDataset,
  getWarningsDataset
} from "./datasets";


function loadOrParseJSON(json: string): any {
  if (typeof json === 'undefined') return null;
  if (typeof json !== 'string') throw new TypeError(`load or parse must get a string`);

  if (json[0] === '@') {
    try {
      json = fs.readFileSync(json.substr(1), 'utf-8');
    } catch (e) {
      throw new Error(`can not load: ${json}`);
    }
  }

  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error(`can not parse: ${json}`);
  }
}

function printUsage() {
  console.log(`
Usage: plyql [options]

Examples:
  plyql -h 10.20.30.40 -q 'SHOW TABLES'

  plyql -h 10.20.30.40 -q 'DESCRIBE twitterstream'

  plyql -h 10.20.30.40 -q 'SELECT MAX(__time) AS maxTime FROM twitterstream'

  plyql -h 10.20.30.40 -s twitterstream -i P5D -q \\
    'SELECT SUM(tweet_length) as TotalTweetLength WHERE first_hashtag = "#imply"'

Arguments:

      --help         print this help message
      --version      display the version number
  -v, --verbose      display the queries that are being made
  -h, --host         the host to connect to
  -s, --source       use this source for the query (supersedes FROM clause)
  -i, --interval     add (AND) a __time filter between NOW-INTERVAL and NOW
  -Z, --timezone     the default timezone
  -o, --output       the output format. Possible values: table (default), json, csv, tsv, flat, plywood, plywood-stream
  -t, --timeout      the time before a query is timed out in ms (default: 180000)
  -r, --retry        the number of tries a query should be attempted on error, 0 = unlimited, (default: 2)
  -c, --concurrent   the limit of concurrent queries that could be made simultaneously, 0 = unlimited, (default: 2)
      --rollup       use rollup mode [COUNT() -> SUM(count)]

  -q, --query        the query to run
      --json-server  the port on which to start the json server
      --experimental-mysql-gateway [Experimental] the port on which to start the MySQL gateway server

      --druid-version            Assume this is the Druid version and do not query it
      --custom-aggregations      A JSON string defining custom aggregations
      --custom-transforms        A JSON string defining custom transforms
      --druid-context            A JSON string representing the Druid context to use
      --skip-cache               disable Druid caching
      --group-by-v2              Set groupByStrategy to 'v2' in the context to ensure use of the V2 GroupBy engine
      --introspection-strategy   Druid introspection strategy
          Possible values:
          * segment-metadata-fallback - (default) use the segmentMetadata and fallback to GET route
          * segment-metadata-only     - only use the segmentMetadata query
          * datasource-get            - only use GET /druid/v2/datasources/DATASOURCE route

      --socks-host       use this socks host to facilitate a Druid connection
      --socks-username  the username for the socks proxy
      --socks-password  the password for the socks proxy

      --force-time       force a column to be interpreted as a time column
      --force-string     force a column to be interpreted as a string column
      --force-boolean    force a column to be interpreted as a boolean
      --force-number     force a column to be interpreted as a number
      --force-unique     force a column to be interpreted as a hyperLogLog uniques
      --force-theta      force a column to be interpreted as a theta sketch
      --force-histogram  force a column to be interpreted as an approximate histogram
`
  )
}

function printVersion(): void {
  let cliPackageFilename = path.join(__dirname, '..', 'package.json');
  let cliPackage: any;
  try {
    cliPackage = JSON.parse(fs.readFileSync(cliPackageFilename, 'utf8'));
  } catch (e) {
    console.log("could not read cli package", e.message);
    return;
  }
  console.log(`plyql version ${cliPackage.version} (plywood version ${version})`);
}

export interface CommandLineArguments {
  "host"?: string;
  "druid"?: string;
  "source"?: string;
  "data-source"?: string;
  "help"?: boolean;
  "query"?: string;
  "json-server"?: number;
  "experimental-mysql-gateway"?: number;
  "interval"?: string;
  "timezone"?: string;
  "version"?: boolean;
  "verbose"?: boolean;
  "timeout"?: number;
  "retry"?: number;
  "concurrent"?: number;
  "output"?: string;
  "force-time"?: string[];
  "force-string"?: string[];
  "force-boolean"?: string[];
  "force-number"?: string[];
  "force-unique"?: string[];
  "force-theta"?: string[];
  "force-histogram"?: string[];
  "druid-version"?: string;
  "custom-aggregations"?: string;
  "custom-transforms"?: string;
  "druid-context"?: string;
  "druid-time-attribute"?: string;
  "rollup"?: boolean;
  "skip-cache"?: boolean;
  "group-by-v2"?: boolean;
  "introspection-strategy"?: string;
  "socks-host"?: string;
  "socks-user"?: string;
  "socks-username"?: string;
  "socks-password"?: string;

  argv?: any;
}

type Mode = 'query' | 'server' | 'gateway';

export function parseArguments(): CommandLineArguments {
  return <any>nopt(
    {
      "host": String,
      "druid": String,
      "source": String,
      "data-source": String,
      "help": Boolean,
      "query": String,
      "json-server": Number,
      "experimental-mysql-gateway": Number,
      "interval": String,
      "timezone": String,
      "version": Boolean,
      "verbose": Boolean,
      "timeout": Number,
      "retry": Number,
      "concurrent": Number,
      "output": String,
      "force-time": [String, Array],
      "force-string": [String, Array],
      "force-boolean": [String, Array],
      "force-number": [String, Array],
      "force-unique": [String, Array],
      "force-theta": [String, Array],
      "force-histogram": [String, Array],
      "druid-version": String,
      "custom-aggregations": String,
      "custom-transforms": String,
      "druid-context": String,
      "druid-time-attribute": String,
      "rollup": Boolean,
      "skip-cache": Boolean,
      "group-by-v2": Boolean,
      "introspection-strategy": String,
      "socks-host": String,
      "socks-user": String,
      "socks-username": String,
      "socks-password": String
    },
    {
      "v": ["--verbose"],
      "h": ["--host"],
      "s": ["--source"],
      "i": ["--interval"],
      "Z": ["--timezone"],
      "o": ["--output"],
      "t": ["--timeout"],
      "r": ["--retry"],
      "c": ["--concurrent"],
      "q": ["--query"]
    },
    process.argv
  );
}

export async function run(parsed: CommandLineArguments): Promise<void> {
  if (parsed.argv.original.length === 0 || parsed.help) {
    printUsage();
    return null;
  }

  if (parsed['version']) {
    printVersion();
    return null;
  }

  let verbose: boolean = parsed['verbose'];
  if (verbose) printVersion();

  // Get forced attribute overrides
  let attributeOverrides: AttributeJSs = [];

  let forceTime: string[] = parsed['force-time'] || [];
  for (let attributeName of forceTime) {
    attributeOverrides.push({ name: attributeName, type: 'TIME' });
  }

  let forceString: string[] = parsed['force-string'] || [];
  for (let attributeName of forceString) {
    attributeOverrides.push({ name: attributeName, type: 'STRING' });
  }

  let forceBoolean: string[] = parsed['force-boolean'] || [];
  for (let attributeName of forceBoolean) {
    attributeOverrides.push({ name: attributeName, type: 'BOOLEAN' });
  }

  let forceNumber: string[] = parsed['force-number'] || [];
  for (let attributeName of forceNumber) {
    attributeOverrides.push({ name: attributeName, type: 'NUMBER' });
  }

  let forceUnique: string[] = parsed['force-unique'] || [];
  for (let attributeName of forceUnique) {
    attributeOverrides.push({ name: attributeName, nativeType: 'hyperUnique' });
  }

  let forceTheta: string[] = parsed['force-theta'] || [];
  for (let attributeName of forceTheta) {
    attributeOverrides.push({ name: attributeName, nativeType: 'thetaSketch' });
  }

  let forceHistogram: string[] = parsed['force-histogram'] || [];
  for (let attributeName of forceHistogram) {
    attributeOverrides.push({ name: attributeName, nativeType: 'approximateHistogram' });
  }

  // Get output
  let output: string = (parsed['output'] || 'table').toLowerCase();
  if (output !== 'table' && output !== 'json' && output !== 'csv' && output !== 'tsv' && output !== 'flat' && output !== 'plywood-stream') {
    throw new Error(`output must be one of table, json, csv, tsv, flat, plywood, or plywood-stream (is ${output})`);
  }

  // Get host
  let host: string = parsed['druid'] || parsed['host'];
  if (!host) {
    throw new Error("must have a host");
  }

  // Get version
  let druidVersion: string = parsed['druid-version'];

  let timezone = Timezone.UTC;
  if (parsed['timezone']) {
    timezone = Timezone.fromJS(parsed['timezone']);
  }

  let timeout: number = hasOwnProp(parsed, 'timeout') ? parsed['timeout'] : 180000;
  let retry: number = hasOwnProp(parsed, 'retry') ? parsed['retry'] : 2;
  let concurrent: number = hasOwnProp(parsed, 'concurrent') ? parsed['concurrent'] : 2;

  let customAggregations: any = loadOrParseJSON(parsed['custom-aggregations']);
  let customTransforms: any = loadOrParseJSON(parsed['custom-transforms']);

  // Druid Context ---------------------------

  let druidContext: Druid.Context = loadOrParseJSON(parsed['druid-context']) || {};
  druidContext.timeout = timeout;

  if (parsed['skip-cache']) {
    druidContext.useCache = false;
    druidContext.populateCache = false;
  }

  if (parsed['group-by-v2']) {
    druidContext['groupByStrategy'] = 'v2';
  }

  let timeAttribute = parsed['druid-time-attribute'] || '__time';

  let filter: Expression = null;
  let intervalString: string = parsed['interval'];
  if (intervalString) {
    let interval: TimeRange;
    try {
      let { computedStart, computedEnd } = parseInterval(intervalString, timezone);
      interval = TimeRange.fromJS({ start: computedStart, end: computedEnd });
    } catch (e) {
      throw new Error(`Could not parse interval: ${intervalString}`);
    }

    filter = $(timeAttribute).overlap(interval);
  }

  let masterSource = parsed['source'] || parsed['data-source'] || null;

  // Get SQL
  if (Number(!!parsed['query']) + Number(!!parsed['json-server']) + Number(!!parsed['experimental-mysql-gateway']) > 1) {
    throw new Error("must set exactly one of --query (-q), --json-server, or --experimental-mysql-gateway");
  }

  let mode: Mode;
  let sqlParse: SQLParse;
  let serverPort: number;
  if (parsed['query']) {
    mode = 'query';
    let query: string = parsed['query'];
    if (verbose) {
      console.log('Received query:');
      console.log(query);
      console.log('---------------------------');
    }

    try {
      sqlParse = Expression.parseSQL(query, timezone);
    } catch (e) {
      throw new Error(`Could not parse query: ${e.message}`);
    }

    if (sqlParse.verb && sqlParse.verb !== 'SELECT') { // DESCRIBE + SHOW get re-written
      throw new Error(`Unsupported SQL verb ${sqlParse.verb} must be SELECT, DESCRIBE, SHOW, or a raw expression`);
    }

    if (verbose && sqlParse.expression) {
      console.log('Parsed query as the following plywood expression (as JSON):');
      console.log(JSON.stringify(sqlParse.expression, null, 2));
      console.log('---------------------------');
    }

  } else if (parsed['json-server']) {
    mode = 'server';
    serverPort = parsed['json-server'];

  } else if (parsed['experimental-mysql-gateway']) {
    mode = 'gateway';
    serverPort = parsed['experimental-mysql-gateway'];

  } else {
    throw new Error("must set one of --query (-q), --json-server, or --experimental-mysql-gateway");
  }

  let socksHost = parsed['socks-host'];
  let socksUsername: string;
  let socksPassword: string;
  if (socksHost) {
    socksUsername = parsed['socks-username'] || parsed['socks-user'];
    socksPassword = parsed['socks-password'];
  }

  // ============== End parse ===============

  let requester = properDruidRequesterFactory({
    druidHost: host,
    retry,
    timeout,
    verbose,
    concurrentLimit: concurrent,
    socksHost,
    socksUsername,
    socksPassword
  });

  // ============== Do introspect ===============

  if (!druidVersion) {
    druidVersion = await DruidExternal.getVersion(requester);
  }

  let onlyDataSource = masterSource || (sqlParse ? sqlParse.table : null);
  let sources: string[];
  if (onlyDataSource) {
    sources = [onlyDataSource];
  } else {
    sources = await DruidExternal.getSourceList(requester);
  }

  if (verbose && !onlyDataSource) {
    console.log(`Found sources [${sources.join(',')}]`);
  }

  let context: Datum = {};

  if (mode === 'gateway') {
    let variablesDataset = getVariablesDataset();
    context['GLOBAL_VARIABLES'] = variablesDataset;
    context['SESSION_VARIABLES'] = variablesDataset;

    let statusDataset = getStatusDataset();
    context['GLOBAL_STATUS'] = statusDataset;
    context['SESSION_STATUS'] = statusDataset;

    context['CHARACTER_SETS'] = getCharacterSetsDataset();
    context['COLLATIONS'] = getCollationsDataset();
    context['KEY_COLUMN_USAGE'] = getKeyColumnUsageDataset();
    context['INDEX'] = getIndexDataset();
    context['WARNINGS'] = getWarningsDataset();
  }

  const introspectedExternals = await Promise.all(sources.map(source => {
    return External.fromJS({
      engine: 'druid',
      version: druidVersion,
      source,
      rollup: parsed['rollup'],
      timeAttribute,
      allowEternity: true,
      allowSelectQueries: true,
      introspectionStrategy: parsed['introspection-strategy'],
      context: druidContext,
      customAggregations,
      customTransforms,
      filter,
      attributeOverrides
    }, requester).introspect()
  }));

  introspectedExternals.forEach((introspectedExternal) => {
    let source = introspectedExternal.source as string;
    context[source] = introspectedExternal;
    addExternal(source, introspectedExternal, mode === 'gateway');
  });

  context['SCHEMATA'] = getSchemataDataset();
  context['TABLES'] = getTablesDataset();
  context['COLUMNS'] = getColumnsDataset();

  if (mode === 'query' && masterSource && !sqlParse.table && !sqlParse.rewrite) {
    context['data'] = context[masterSource];
  }

  if (verbose) console.log(`introspection complete`);

  // Do query
  switch (mode) {
    case 'query':
      let valueStream = executeSQLParseStream(sqlParse, context, timezone);

      valueStream.on('error', (e: Error) => {
        console.error(`Could not compute query due to error: ${e.message}`);
      });

      valueStream
        .pipe(getOutputTransform(output, timezone))
        .pipe(process.stdout);

      return null;

    case 'gateway':
      require('./plyql-mysql-gateway').plyqlMySQLGateway(serverPort, context, timezone, null);
      return null;

    case 'server':
      require('./plyql-json-server').plyqlJSONServer(serverPort, context, timezone, null);
      return null;

    default:
      throw new Error(`unsupported mode ${mode}`);
  }
}
