# Change Log

For updates follow [@implydata](https://twitter.com/implydata) on Twitter.

## 0.9.14

- Added support for `SHOW CHARACTER SET`
- Added support for `SHOW COLLATION`

## 0.9.13

- Support for encoding defined string literals (e.g. `N'lol'`, `_utf8'lol'`)

## 0.9.12

- Minor fix

## 0.9.11

- Fixed `realpath` / `readlink -f` for good (maybe) 

## 0.9.10

- `--timezone` option now affects the output timezone also
- `realpath` -> `readlink -f` (I hate shell scripts)

## 0.9.9

- Added missing realpath

## 0.9.8

- Added better node lookup to handle either `node` or `nodejs` for the Debian people

## 0.9.7

- Added `--custom-aggregations` option: A JSON string defining custom aggregations
- Added `--custom-transforms` option: A JSON string defining custom transforms
- Added ability to load `--druid-context` from file using `@filename` notation

## 0.9.6

- Plywood version bump

## 0.9.5

- Plywood version bump

## 0.9.4

- Plywood version bump

## 0.9.3

- Plywood version bump

## 0.9.2

- Updated to latest Plywood with misc bug fixes

## 0.9.1

- Using the brand new rebuilt Plywood
- Fixes error in NOT having filter being ignored
- Better type injection with TDI

## 0.8.19

- New plywood supports SHOW STATUS
- Fix BETWEEN inclusiveness

## 0.8.18

- Support for QUARTER

## 0.8.17

- Fixed case insensitivity bug in introspection queries

## 0.8.16

- Using moment-timezone

## 0.8.15

- More tests
- General support for `*Filtered` dimensions specs

## 0.8.14

- Support Druid's `regexFiltered` via new Plywood

## 0.8.13

- Allow caSe insEnsitIviTy

## 0.8.12

- Complied with TypeScript2.0

## 0.8.11

- Fixed problem when rendering a single column table would fail if a `null` existed as a value.

## 0.8.10

- Updated file notices

## 0.8.9

- New plywood adds string comparisons

## 0.8.8

- New plywood fixes JS expressions

## 0.8.7

- Empty result set works with table rendering

## 0.8.6

- Remove shrinkwrap
- Upgrade dependencies

## 0.8.5

- Added shrinkwrap

## 0.8.4

- New plywood

## 0.8.3

- Using latest plywood that fixed `AS` logic
- Druid 0.9.1 compatible

## 0.8.2

- Added `/plywood` route test

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
