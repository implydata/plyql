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
`-d`, `--data-source`      | use this data source for the query (supersedes FROM clause)
`-i`, `--interval`         | add (AND) a `__time` filter between NOW-INTERVAL and NOW
`-q`, `--query`            | the query to run
`-o`, `--output`           | specify the output format. Possible values: `json` **(default)**, `csv`, `tsv`, `flat`
`-a`, `--allow`            | enable a behaviour that is turned off by default `eternity` allow queries not filtered on time `select` allow select queries
`-t`, `--timeout`          | the time before a query is timed out in ms (default: 60000)
`-r`, `--retry`            | the number of tries a query should be attempted on error, 0 = unlimited, (default: 2)
`-c`, `--concurrent`       | the limit of concurrent queries that could be made simultaneously, 0 = unlimited, (default: 2)
`--rollup`                 | use rollup mode [COUNT() -> SUM(count)]
`--druid-version`          | Assume this is the Druid version and do not query it
`--skip-cache`             | disable Druid caching
`--introspection-strategy` | Druid introspection strategy. Use `--help` for possible values
`-fu`, `--force-unique`    | force a column to be interpreted as a hyperLogLog uniques
`-fh`, `--force-histogram` | force a column to be interpreted as an approximate histogram

For information on specific operators and functions supported by PlyQL please see: [PlyQL language reference](http://plywood.imply.io/plyql).

## Examples

For these examples a Druid broker node hosted on a docker machine with ip `192.168.60.100` at port `8082`, for example `192.168.60.100:8082`.
There is a data source called `wikipedia` that has a day of wikipedia edits.

Here is a simple query that gets the maximum of the `__time`. This query displays the time of the latest event in the database.

```sql
plyql -h 192.168.60.100:8082 -q "SELECT MAX(__time) AS maxTime FROM wikipedia"
```

Returns:

```json
[
  {
    "maxTime": {
      "type": "TIME",
      "value": "2015-09-12T23:59:00.000Z"
    }
  }
]
```

Ok now you might want to examine the different hashtags that are trending.

You might do a GROUP BY on the `first_hashtag` column like this:

```sql
plyql -h 192.168.60.100:8082 -q "
SELECT page as pg, 
COUNT() as cnt 
FROM wikipedia 
GROUP BY page 
ORDER BY cnt DESC 
LIMIT 5;
"
```

This will throw an error because there is no time filter specified and the plyql guards against this.

This behaviour can be disabled using the `--allow eternity` flag but it is generally bad idea to do it when working with
large amounts of data as it can issue computationally prohibitive queries.
  
Try it again, with a time filter:
  
```sql
plyql -h 192.168.60.100:8082 -q "
SELECT page as pg, 
COUNT() as cnt 
FROM wikipedia 
WHERE '2015-09-12T00:00:00' <= __time AND __time < '2015-09-13T00:00:00' 
GROUP BY page 
ORDER BY cnt DESC 
LIMIT 5;
"
```

Results:
  
```json
[
  {
    "cnt": 314,
    "pg": "Jeremy Corbyn"
  },
  {
    "cnt": 255,
    "pg": "User:Cyde/List of candidates for speedy deletion/Subpage"
  },
  {
    "cnt": 228,
    "pg": "Wikipedia:Administrators' noticeboard/Incidents"
  },
  {
    "cnt": 186,
    "pg": "Wikipedia:Vandalismusmeldung"
  },
  {
    "cnt": 160,
    "pg": "Total Drama Presents: The Ridonculous Race"
  }
]
```
  
Plyql has an option `--interval` (`-i`) that automatically filters time on the last `interval` worth of time.
It is useful if you do not want to type out a time filter.

```sql
plyql -h 192.168.60.100:8082 -i P1Y -q "
SELECT page as pg, 
COUNT() as cnt 
FROM wikipedia 
GROUP BY page 
ORDER BY cnt DESC 
LIMIT 5;
"
```

To get a breakdown by time the `TIME_BUCKET` function can be used:

```sql
plyql -h 192.168.60.100:8082 -i P1Y -q "
SELECT SUM(added) as TotalAdded 
FROM wikipedia 
GROUP BY TIME_BUCKET(__time, PT6H, 'Etc/UTC');
"
```

Returns:

```json
[
  {
    "TotalAdded": 15426936,
    "split0": {
      "start": "2015-09-12T00:00:00.000Z",
      "end": "2015-09-12T06:00:00.000Z",
      "type": "TIME_RANGE"
    }
  },
  {
    "TotalAdded": 25996165,
    "split0": {
      "start": "2015-09-12T06:00:00.000Z",
      "end": "2015-09-12T12:00:00.000Z",
      "type": "TIME_RANGE"
    }
  },
  "... results omitted ..."
]
```

Note that the grouping column was not selected but was still returned as if `TIME_BUCKET(__time, PT1H, 'Etc/UTC') as 'split'`
was one of the select clauses.

Time parting is also supported, here is an example:

```sql
plyql -h 192.168.60.100:8082 -i P1Y -q "
SELECT TIME_PART(__time, HOUR_OF_DAY, 'Etc/UTC') as HourOfDay, 
SUM(added) as TotalAdded 
FROM wikipedia 
GROUP BY 1 
ORDER BY TotalAdded DESC LIMIT 3;
"
```

Notice that this `GROUP BY` is referring to the first column in the select.

This returns:

```json
[
  {
    "TotalAdded": 8077302,
    "HourOfDay": 10
  },
  {
    "TotalAdded": 5998730,
    "HourOfDay": 17
  },
  {
    "TotalAdded": 5210222,
    "HourOfDay": 18
  }
]
```

It is also possible to do multi dimensional GROUP BYs

```sql
plyql -h 192.168.60.100:8082 -i P1Y -q "
SELECT TIME_BUCKET(__time, PT1H, 'Etc/UTC') as Hour, 
page as PageName, 
SUM(added) as TotalAdded 
FROM wikipedia 
GROUP BY 1, 2 
ORDER BY TotalAdded DESC 
LIMIT 3;"
"
```

Returns:

```json
[
  {
    "TotalAdded": 242211,
    "PageName": "Wikipedia‐ノート:即時削除の方針/過去ログ16",
    "Hour": {
      "start": "2015-09-12T15:00:00.000Z",
      "end": "2015-09-12T16:00:00.000Z",
      "type": "TIME_RANGE"
    }
  },
  {
    "TotalAdded": 232941,
    "PageName": "Користувач:SuomynonA666/Заготовка",
    "Hour": {
      "start": "2015-09-12T14:00:00.000Z",
      "end": "2015-09-12T15:00:00.000Z",
      "type": "TIME_RANGE"
    }
  },
  {
    "TotalAdded": 214017,
    "PageName": "User talk:Estela.rs",
    "Hour": {
      "start": "2015-09-12T12:00:00.000Z",
      "end": "2015-09-12T13:00:00.000Z",
      "type": "TIME_RANGE"
    }
  }
]
```

Here is an advanced example that gets the top 5 hashtags by time. PlyQL allows us to nest queries as
aggregates like so:

```sql
plyql -h localhost:8082 -i P1D -q "
SELECT
first_hashtag as hashtag,
COUNT() as cnt,
(
  SELECT
  SUM(tweet_length) as TotalTweetLength
  GROUP BY TIME_BUCKET(__time, PT1H, 'Etc/UTC')
  LIMIT 3    -- only get the first 3 hours to keep this example output small
) as 'ByTime'
FROM twitter
GROUP BY first_hashtag
ORDER BY cnt DESC
LIMIT 5
"
```
```sql
plyql -h 192.168.60.100:8082 -i P1Y -q "
SELECT page as Page, 
COUNT() as cnt, 
(
  SELECT SUM(added) as TotalAdded 
  GROUP BY TIME_BUCKET(__time, PT1H, 'Etc/UTC') 
  LIMIT 3
) as 'ByTime' 
FROM wikipedia 
GROUP BY page 
ORDER BY cnt DESC 
LIMIT 5;
"
```

Returns:

```json
[
  {
    "cnt": 314,
    "Page": "Jeremy Corbyn",
    "ByHour": [
      {
        "TotalAdded": 1075,
        "split0": {
          "start": "2015-09-12T01:00:00.000Z",
          "end": "2015-09-12T02:00:00.000Z",
          "type": "TIME_RANGE"
        }
      },
      {
        "TotalAdded": 0,
        "split0": {
          "start": "2015-09-12T07:00:00.000Z",
          "end": "2015-09-12T08:00:00.000Z",
          "type": "TIME_RANGE"
        }
      },
      {
        "TotalAdded": 10553,
        "split0": {
          "start": "2015-09-12T08:00:00.000Z",
          "end": "2015-09-12T09:00:00.000Z",
          "type": "TIME_RANGE"
        }
      }
    ]
  },
  {
    "hashtag": "FOLLOWTRICK",
    "cnt": 11553,
    "ByTime": [
      {
        "TotalTweetLength": 5227,
        "split": {
          "start": "2015-04-19T06:00:00.000Z",
          "end": "2015-04-19T07:00:00.000Z",
          "type": "TIME_RANGE"
        }
      },
      "... results omitted ..."
    ]
  },
  "... results omitted ..."
]
```

## Roadmap

Here is a list of features that is not currently supported that are in the works:

* Query simulation - preview the queries that will be run without running them
* Sub-queries in WHERE clauses  
* JOIN support
* Window functions

## Questions & Support

For updates about new and upcoming features follow [@implydata](https://twitter.com/implydata) on Twitter.
                             
Please file bugs and feature requests by opening and issue on GitHub and direct all questions to our [user groups](https://groups.google.com/forum/#!forum/imply-user-group).
