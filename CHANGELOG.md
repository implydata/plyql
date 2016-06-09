# Change Log

For updates follow [@implydata](https://twitter.com/implydata) on Twitter.

## 0.8.1

- Changed `--data-source` (`-d`) to `--source` (`-s`)

## 0.7.14

- New Plywood support `SHOW FULL TABLES`
- New Plywood support GROUP BY on time on non primary time dimensions

## 0.7.13

- `--force-number` can force columns to be interpreted as number
- Allow paginated select queries

## 0.7.12

- JSON Server does not fail on unknown table error

## 0.7.11

- Correct column ordering in CSV and TSV outputs

## 0.7.10

- Fixed JDBC tests
- Changed some MySQL variables

## 0.7.9

- `--force-time` can force columns to be interpreted as time
- `--force-boolean` can force columns to be interpreted as boolean

## 0.7.8

- Theta sketches supported
- `--force-theta` can force columns to be interpreted as theta sketches
- `--druid-context` allows passing custom JSON as the Druid context 

This query is now possible:
`plyql -h 192.168.99.100 -v --druid-context '{"lol":1}' -q "SELECT COUNT(DISTINCT user_theta) FROM wikipedia";`

## 0.7.7

- CLI parameter `--druid-version` no longer ignored
- New plywood

## 0.7.6

- Run unit tests as part of publish

## 0.7.5

- No git dependencies, new plywood parses `SELECT current_user();`

## 0.7.4

- Fix packaging problem

## 0.7.3

- Better support for JDBC connection

## 0.7.2

- Support for JDBC connection

## 0.7.1

- Started this changelog
- Changed default output mode to `table`
- Added server mode
- Added MySQL gateway
- Removed `--allow` (`-a`) option it is always set to allow now
- Removed `-fu` and `-fh` shortcuts
- `-t` is now a shortcut for `--timeout`
- `-Z` is now a shortcut for `--timezone`
