/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/nopt/nopt.d.ts" />
/// <reference path="../typings/mysql2/mysql2.d.ts" />
/// <reference path="../node_modules/plywood/build/plywood.d.ts" />
/// <reference path="../node_modules/plywood-druid-requester/build/plywood-druid-requester.d.ts" />

import * as fs from 'fs';
import * as path from "path";
import * as Q from 'q';
import * as nopt from "nopt";

import { WallTime, Timezone, Duration, parseInterval } from "chronoshift";
if (!WallTime.rules) {
  var tzData = require("chronoshift/lib/walltime/walltime-data.js");
  WallTime.init(tzData.rules, tzData.zones);
}

import { $, Expression, Datum, Dataset, PlywoodValue, TimeRange,
  External, DruidExternal, AttributeJSs, helper, version } from "plywood";

import { properDruidRequesterFactory } from "./requester.ts";

import { getVariablesDataset } from './variables';
import { addExternal, getSchemataDataset, getTablesDataset, getColumnsDataset } from './schema';


function printUsage() {
  console.log(`
Usage: plyql [options]

Examples:
  plyql -h 10.20.30.40 -q 'SHOW TABLES'

  plyql -h 10.20.30.40 -q 'DESCRIBE twitterstream'

  plyql -h 10.20.30.40 -q 'SELECT MAX(__time) AS maxTime FROM twitterstream'

  plyql -h 10.20.30.40 -d twitterstream -i P5D -q \
    'SELECT SUM(tweet_length) as TotalTweetLength WHERE first_hashtag = "#imply"'

Arguments:

       --help         print this help message
       --version      display the version number
  -v,  --verbose      display the queries that are being made
  -h,  --host         the host to connect to
  -d,  --data-source  use this data source for the query (supersedes FROM clause)
  -i,  --interval     add (AND) a __time filter between NOW-INTERVAL and NOW
  -tz, --timezone     the default timezone  
  -o,  --output       the output format. Possible values: json (default), csv, tsv, flat
  -t,  --timeout      the time before a query is timed out in ms (default: 180000)
  -r,  --retry        the number of tries a query should be attempted on error, 0 = unlimited, (default: 2)
  -c,  --concurrent   the limit of concurrent queries that could be made simultaneously, 0 = unlimited, (default: 2)
       --rollup       use rollup mode [COUNT() -> SUM(count)]
       
  -q,  --query        the query to run
       --experimental-mysql-facade  [Experimental] the port on which to start the MySQL facade server

       --druid-version            Assume this is the Druid version and do not query it
       --skip-cache               disable Druid caching
       --introspection-strategy   Druid introspection strategy
          Possible values:
          * segment-metadata-fallback - (default) use the segmentMetadata and fallback to GET route
          * segment-metadata-only     - only use the segmentMetadata query
          * datasource-get            - only use GET /druid/v2/datasources/DATASOURCE route

  -fu, --force-unique     force a column to be interpreted as a hyperLogLog uniques
  -fh, --force-histogram  force a column to be interpreted as an approximate histogram

  -a,  --allow        enable a behaviour that is turned off by default
           eternity     allow queries not filtered on time
           select       allow 'select' queries
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
  "experimental-mysql-facade"?: number;
  "interval"?: string;
  "timezone"?: string;
  "version"?: boolean;
  "verbose"?: boolean;
  "timeout"?: number;
  "retry"?: number;
  "concurrent"?: number;
  "output"?: string;
  "allow"?: string[];
  "force-unique"?: string[];
  "force-histogram"?: string[];
  "druid-version"?: string;
  "rollup"?: boolean;
  "skip-cache"?: boolean;
  "introspection-strategy"?: string;

  argv?: any;
}

export function parseArguments(): CommandLineArguments {
  return <any>nopt(
    {
      "host": String,
      "druid": String,
      "data-source": String,
      "help": Boolean,
      "query": String,
      "experimental-mysql-facade": Number,
      "interval": String,
      "timezone": String,
      "version": Boolean,
      "verbose": Boolean,
      "timeout": Number,
      "retry": Number,
      "concurrent": Number,
      "output": String,
      "allow": [String, Array],
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
      "a": ["--allow"],
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

    // Get allow
    var allows: string[] = parsed['allow'] || [];
    for (let allow of allows) {
      if (!(allow === 'eternity' || allow === 'select')) {
        throw new Error(`Unexpected allow '${allow}'`);
      }
    }

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
    var output: string = (parsed['output'] || 'json').toLowerCase();
    if (output !== 'json' && output !== 'csv' && output !== 'tsv' && output !== 'flat') {
      throw new Error(`output must be one of json, csv, tsv, or flat (is ${output}})`);
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

    var introspectedExternals = sourceList.then((sources) => {
      if (verbose) {
        console.log(`Found sources [${sources.join(',')}]`);
      }

      return Q.all(sources.map(source => {
        return External.fromJS({
            engine: 'druid',
            dataSource: source,
            timeAttribute: 'time',
            allowEternity: true,
            allowSelectQueries: true,
            context: druidContext,
            filter
          }, requester)
          .introspect()
          .then((introspectedExternal) => {
            context[source] = introspectedExternal;
            addExternal(source, introspectedExternal);
          });
      }));
    });

    //introspectedExternals

    //experimental-mysql-facade


    // Get SQL
    var query: string = parsed['query'];
    if (query) {
      if (verbose) {
        console.log('Received query:');
        console.log(query);
        console.log('---------------------------');
      }

      try {
        var sqlParse = Expression.parseSQL(query, timezone);
      } catch (e) {
        throw new Error(`Could not parse query: ${e.message}`);
      }

      if (sqlParse.verb && sqlParse.verb !== 'SELECT' && sqlParse.verb !== 'DESCRIBE' && sqlParse.verb !== 'SHOW') {
        throw new Error(`Unsupported SQL verb ${sqlParse.verb} must be SELECT, DESCRIBE, SHOW, or a raw expression`);
      }
    } else {
      throw new Error("no query found please use --query (-q) flag");
    }

    var expression = sqlParse.expression;

    if (verbose && expression) {
      console.log('Parsed query as the following plywood expression (as JSON):');
      console.log(JSON.stringify(expression, null, 2));
      console.log('---------------------------');
    }

    if (sqlParse.rewrite === 'SHOW') {
      if (!/SHOW +TABLES/i.test(query)) {
        throw new Error(`Only SHOW TABLES is supported`);
      }

      return DruidExternal.getSourceList(requester)
        .then((sources) => {
          console.log(JSON.stringify(sources, null, 2));
        })
        .catch((err: Error) => {
          throw new Error(`There was an error getting the source list: ${err.message}`);
        })
    }

    var dataName = 'data';
    var dataSource: string;
    if (parsed['data-source']) {
      dataSource = parsed['data-source'];
    } else if (sqlParse.table) {
      dataName = sqlParse.table;
      dataSource = sqlParse.table;
    } else {
      throw new Error("must have data source");
    }

    var druidContext: Druid.Context = {
      timeout
    };

    if (parsed['skip-cache']) {
      druidContext.useCache = false;
      druidContext.populateCache = false;
    }

    try {
      var external = External.fromJS({
        engine: 'druid',
        version: parsed['druid-version'],
        dataSource,
        rollup: parsed['rollup'],
        timeAttribute,
        allowEternity: allows.indexOf('eternity') !== -1,
        allowSelectQueries: allows.indexOf('select') !== -1,
        introspectionStrategy: parsed['introspection-strategy'],
        filter,
        attributeOverrides,
        context: druidContext
      }, requester);
    } catch (e) {
      throw new Error(`Error making external: ${e.message}`);
    }

    if (sqlParse.verb === 'DESCRIBE') {
      return external.introspect()
        .then((introspectedExternal) => {
          console.log(JSON.stringify(introspectedExternal.toJS().attributes, null, 2));
        })
        .catch((err: Error) => {
          throw new Error(`There was an error getting the metadata: ${err.message}`);
        })

    } else if (!sqlParse.verb || sqlParse.verb === 'SELECT') {
      var context: Datum = {};
      context[dataName] = external;

      return expression.compute(context, { timezone })
        .then((data: PlywoodValue) => {
          var outputStr: string;
          if (Dataset.isDataset(data)) {
            var dataset = <Dataset>data;
            switch (output) {
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

    } else {
      throw new Error(`Unsupported verb ${sqlParse.verb}`);

    }
  });
}
