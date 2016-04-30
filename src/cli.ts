/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/nopt/nopt.d.ts" />
/// <reference path="../node_modules/plywood/build/plywood.d.ts" />
/// <reference path="../node_modules/plywood-druid-requester/build/plywood-druid-requester.d.ts" />
/// <reference path="../typings/table/table.d.ts" />

import * as fs from 'fs';
import * as path from "path";
import * as Q from 'q';
import * as nopt from "nopt";
import table, { getBorderCharacters } from 'table';

import { WallTime, Timezone, Duration, parseInterval } from "chronoshift";
if (!WallTime.rules) {
  var tzData = require("chronoshift/lib/walltime/walltime-data.js");
  WallTime.init(tzData.rules, tzData.zones);
}

import { $, Expression, Datum, Dataset, PlywoodValue, TimeRange,
  External, DruidExternal, AttributeJSs, SQLParse, version } from "plywood";

import { properDruidRequesterFactory } from "./requester";
import { executeSQLParse } from "./plyql-executor";

import { getVariablesDataset } from './variables';
import { addExternal, getSchemataDataset, getTablesDataset, getColumnsDataset } from './schema';

function printUsage() {
  console.log(`
Usage: plyql [options]

Examples:
  plyql -h 10.20.30.40 -q 'SHOW TABLES'

  plyql -h 10.20.30.40 -q 'DESCRIBE twitterstream'

  plyql -h 10.20.30.40 -q 'SELECT MAX(__time) AS maxTime FROM twitterstream'

  plyql -h 10.20.30.40 -d twitterstream -i P5D -q \\
    'SELECT SUM(tweet_length) as TotalTweetLength WHERE first_hashtag = "#imply"'

Arguments:

       --help         print this help message
       --version      display the version number
  -v,  --verbose      display the queries that are being made
  -h,  --host         the host to connect to
  -d,  --data-source  use this data source for the query (supersedes FROM clause)
  -i,  --interval     add (AND) a __time filter between NOW-INTERVAL and NOW
  -tz, --timezone     the default timezone  
  -o,  --output       the output format. Possible values: table (default), json, csv, tsv, flat
  -t,  --timeout      the time before a query is timed out in ms (default: 180000)
  -r,  --retry        the number of tries a query should be attempted on error, 0 = unlimited, (default: 2)
  -c,  --concurrent   the limit of concurrent queries that could be made simultaneously, 0 = unlimited, (default: 2)
       --rollup       use rollup mode [COUNT() -> SUM(count)]
       
  -q,  --query        the query to run
       --json-server  the port on which to start the json server
       --experimental-mysql-gateway [Experimental] the port on which to start the MySQL gateway server

       --druid-version            Assume this is the Druid version and do not query it
       --skip-cache               disable Druid caching
       --introspection-strategy   Druid introspection strategy
           Possible values:
           * segment-metadata-fallback - (default) use the segmentMetadata and fallback to GET route
           * segment-metadata-only     - only use the segmentMetadata query
           * datasource-get            - only use GET /druid/v2/datasources/DATASOURCE route

  -fu, --force-unique     force a column to be interpreted as a hyperLogLog uniques
  -fh, --force-histogram  force a column to be interpreted as an approximate histogram
`
  )
}

function printVersion(): void {
  var cliPackageFilename = path.join(__dirname, '..', 'package.json');
  try {
    var cliPackage = JSON.parse(fs.readFileSync(cliPackageFilename, 'utf8'));
  } catch (e) {
    console.log("could not read cli package", e.message);
    return;
  }
  console.log(`plyql version ${cliPackage.version} (plywood version ${version})`);
}

export interface CommandLineArguments {
  "host"?: string;
  "druid"?: string;
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
  "force-unique"?: string[];
  "force-histogram"?: string[];
  "druid-version"?: string;
  "rollup"?: boolean;
  "skip-cache"?: boolean;
  "introspection-strategy"?: string;

  argv?: any;
}

type Mode = 'query' | 'server' | 'gateway';

export function parseArguments(): CommandLineArguments {
  return <any>nopt(
    {
      "host": String,
      "druid": String,
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
      "force-unique": [String, Array],
      "force-histogram": [String, Array],
      "druid-version": String,
      "rollup": Boolean,
      "skip-cache": Boolean,
      "introspection-strategy": String
    },
    {
      "h": ["--host"],
      "q": ["--query"],
      "v": ["--verbose"],
      "d": ["--data-source"],
      "i": ["--interval"],
      "tz": ["--timezone"],
      "r": ["--retry"],
      "c": ["--concurrent"],
      "o": ["--output"],
      "fu": ["--force-unique"],
      "fh": ["--force-histogram"]
    },
    process.argv
  );
}

export function run(parsed: CommandLineArguments): Q.Promise<any> {
  return Q.fcall(() => {
    if (parsed.argv.original.length === 0 || parsed.help) {
      printUsage();
      return;
    }

    if (parsed['version']) {
      printVersion();
      return;
    }

    var verbose: boolean = parsed['verbose'];
    if (verbose) printVersion();

    // Get forced attribute overrides
    var attributeOverrides: AttributeJSs = [];
    var forceUnique: string[] = parsed['force-unique'] || [];
    for (let attributeName of forceUnique) {
      attributeOverrides.push({ name: attributeName, special: 'unique' });
    }
    var forceHistogram: string[] = parsed['force-histogram'] || [];
    for (let attributeName of forceHistogram) {
      attributeOverrides.push({ name: attributeName, special: 'histogram' });
    }

    // Get output
    var output: string = (parsed['output'] || 'table').toLowerCase();
    if (output !== 'table' && output !== 'json' && output !== 'csv' && output !== 'tsv' && output !== 'flat') {
      throw new Error(`output must be one of table, json, csv, tsv, or flat (is ${output})`);
    }

    // Get host
    var host: string = parsed['druid'] || parsed['host'];
    if (!host) {
      throw new Error("must have a host");
    }

    var timezone = Timezone.UTC;
    if (parsed['timezone']) {
      timezone = Timezone.fromJS(parsed['timezone']);
    }

    var timeout: number = parsed.hasOwnProperty('timeout') ? parsed['timeout'] : 180000;
    var retry: number = parsed.hasOwnProperty('retry') ? parsed['retry'] : 2;
    var concurrent: number = parsed.hasOwnProperty('concurrent') ? parsed['concurrent'] : 2;

    var druidContext: Druid.Context = {
      timeout
    };

    if (parsed['skip-cache']) {
      druidContext.useCache = false;
      druidContext.populateCache = false;
    }

    var timeAttribute = '__time';

    var filter: Expression = null;
    var intervalString: string = parsed['interval'];
    if (intervalString) {
      try {
        var { computedStart, computedEnd } = parseInterval(intervalString, timezone);
        var interval = TimeRange.fromJS({ start: computedStart, end: computedEnd });
      } catch (e) {
        throw new Error(`Could not parse interval: ${intervalString}`);
      }

      filter = $(timeAttribute).in(interval);
    }

    var dataSource = parsed['data-source'] || null;

    // Get SQL
    if (Number(!!parsed['query']) + Number(!!parsed['json-server']) + Number(!!parsed['experimental-mysql-gateway']) > 1) {
      throw new Error("must set exactly one of --query (-q), --json-server, or --experimental-mysql-gateway");
    }

    var mode: Mode;
    var sqlParse: SQLParse;
    var serverPort: number;
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

    // ============== End parse ===============

    var requester = properDruidRequesterFactory({
      druidHost: host,
      retry,
      timeout,
      verbose,
      concurrentLimit: concurrent
    });

    // ============== Do introspect ===============

    var sourceList = dataSource ? Q([dataSource]) : DruidExternal.getSourceList(requester);

    var contextPromise = sourceList.then((sources) => {
      if (verbose) {
        console.log(`Found sources [${sources.join(',')}]`);
      }

      var context: Datum = {};

      var variablesDataset = getVariablesDataset();
      context['GLOBAL_VARIABLES'] = variablesDataset;
      context['SESSION_VARIABLES'] = variablesDataset;

      return Q.all(sources.map(source => {
        return External.fromJS({
          engine: 'druid',
          dataSource: source,
          rollup: parsed['rollup'],
          timeAttribute,
          allowEternity: true,
          allowSelectQueries: true,
          introspectionStrategy: parsed['introspection-strategy'],
          context: druidContext,
          filter,
          attributeOverrides
        }, requester)
          .introspect()
          .then((introspectedExternal) => {
            context[source] = introspectedExternal;
            addExternal(source, introspectedExternal, mode === 'gateway');
          });
      }))
        .then(() => {
          context['SCHEMATA'] = getSchemataDataset();
          context['TABLES'] = getTablesDataset();
          context['COLUMNS'] = getColumnsDataset();

          if (mode === 'query' && dataSource && !sqlParse.table && !sqlParse.rewrite) {
            context['data'] = context[dataSource];
          }

          if (verbose) console.log(`introspection complete`);

          return context
        });
    });

    return contextPromise.then((context) => {
      switch (mode) {
        case 'query':
          return executeSQLParse(sqlParse, context, timezone)
            .then((data: PlywoodValue) => {
              var outputStr: string;
              if (Dataset.isDataset(data)) {
                var dataset = <Dataset>data;
                switch (output) {
                  case 'table':
                    var columns = dataset.getColumns();
                    var flatData = dataset.flatten();
                    var columnNames = columns.map(c => c.name);

                    var tableData = [columnNames].concat(flatData.map(flatDatum => columnNames.map(cn => flatDatum[cn])));

                    outputStr = table(tableData, {
                      border: getBorderCharacters('norc'),
                      drawHorizontalLine: (index: number, size: number) => index <= 1 || index === size
                    });
                    break;

                  case 'json':
                    outputStr = JSON.stringify(dataset, null, 2);
                    break;

                  case 'csv':
                    outputStr = dataset.toCSV({ finalLineBreak: 'include' });
                    break;

                  case 'tsv':
                    outputStr = dataset.toTSV({ finalLineBreak: 'include' });
                    break;

                  case 'flat':
                    outputStr = JSON.stringify(dataset.flatten(), null, 2);
                    break;

                  default:
                    outputStr = 'Unknown output type';
                    break;
                }
              } else {
                outputStr = String(data);
              }
              console.log(outputStr);
            })
            .catch((err: Error) => {
              throw new Error(`There was an error getting the data: ${err.message}`);
            });

        case 'gateway':
          require('./plyql-mysql-gateway').plyqlMySQLGateway(serverPort, context, timezone, null);
          return null;

        case 'server':
          require('./plyql-json-server').plyqlJSONServer(serverPort, context, timezone, null);
          return null;

        default:
          throw new Error(`unsupported mode ${mode}`);
      }

    });

  });
}
