# PlyQL

A SQL-like interface to plywood

## Installation

PlyQL is built on top of node so make sure you have node >= 4.x.x installed.

```
npm install -g plyql
```

The global install will make the `plyql` command available system wide.

## Usage

Currently only queries to Druid are supported. More support will come in the future. 

The CLI supports the following options:

Option                     | Description
---------------------------|-----------------------------------------
`--help`                   | print this help message
`--version`                | display the version number
`-v`, `--verbose`          | display the queries that are being made
`-h`, `--host`             | the host to connect to
`-s`, `--source`           | use this source for the query (supersedes FROM clause)
`-i`, `--interval`         | add (AND) a `__time` filter between NOW-INTERVAL and NOW
`-tz`, `--timezone`        | the default timezone
`-q`, `--query`            | the query to run
`-o`, `--output`           | specify the output format. Possible values: `json` **(default)**, `csv`, `tsv`, `flat`
`-a`, `--allow`            | enable a behaviour that is turned off by default `eternity` allow queries not filtered on time `select` allow select queries
`-t`, `--timeout`          | the time before a query is timed out in ms (default: 60000)
`-r`, `--retry`            | the number of tries a query should be attempted on error, 0 = unlimited, (default: 2)
`-c`, `--concurrent`       | the limit of concurrent queries that could be made simultaneously, 0 = unlimited, (default: 2)
`--rollup`                 | use rollup mode [COUNT() -> SUM(count)]
`--druid-version`          | Assume this is the Druid version and do not query for it
`--skip-cache`             | disable Druid caching
`--introspection-strategy` | Druid introspection strategy. Use `--help` for possible values
`--force-time`             | force a column to be interpreted as a time column
`--force-string`           | force a column to be interpreted as a string column
`--force-boolean`          | force a column to be interpreted as a boolean column
`--force-number`           | force a column to be interpreted as a number column
`--force-unique`           | force a column to be interpreted as a hyperLogLog uniques
`--force-theta`            | force a column to be interpreted as a [theta sketch](http://druid.io/docs/latest/development/extensions-core/datasketches-aggregators.html)
`--force-histogram`        | force a column to be interpreted as an approximate histogram (for quantiles)

For information on specific operators and functions supported by PlyQL please see: [PlyQL language reference](http://plywood.imply.io/plyql).

## Examples

For an introduction and examples please see: [PlyQL language reference](http://plywood.imply.io/plyql#examples).

## Roadmap

Here is a list of features that is not currently supported that are in the works:

* Query simulation - preview the queries that will be run without running them
* Sub-queries in WHERE clauses  
* JOIN support
* Window functions

## Questions & Support

For updates about new and upcoming features follow [@implydata](https://twitter.com/implydata) on Twitter.
                             
Please file bugs and feature requests by opening and issue on GitHub and direct all questions to our [user groups](https://groups.google.com/forum/#!forum/imply-user-group).
