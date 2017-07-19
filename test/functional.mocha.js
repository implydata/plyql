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

const { expect } = require('chai');
const { sane, parseLineJson } = require('./utils/utils.js');
const { exec } = require('child_process');
const Q = require('q');

const druidHost = '192.168.99.100';

describe('query', function() {
  this.timeout(10000);

  it('does basic query', (testComplete) => {
    exec(`bin/plyql -h ${druidHost} -q 'SELECT 1+1'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain(sane`
        ┌─────┐
        │ 1+1 │
        ├─────┤
        │ 2   │
        └─────┘
      `);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does basic query with json output', (testComplete) => {
    exec(`bin/plyql -h ${druidHost} -o json -q 'SELECT 1+1'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(parseLineJson(stdout)).to.deep.equal([
        {
          "1+1": 2
        }
      ]);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does a SELECT query GROUP BY', (testComplete) => {
    exec(`bin/plyql -h ${druidHost} -q 'SELECT page, SUM(count) AS 'Count' FROM wikipedia WHERE channel = "en" GROUP BY page ORDER BY Count DESC LIMIT 3;'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain(sane`
        ┌──────────────────────────────────────────────────────────┬───────┐
        │ page                                                     │ Count │
        ├──────────────────────────────────────────────────────────┼───────┤
        │ User:Cyde/List of candidates for speedy deletion/Subpage │ 255   │
        │ Jeremy Corbyn                                            │ 241   │
        │ Wikipedia:Administrators' noticeboard/Incidents          │ 228   │
        └──────────────────────────────────────────────────────────┴───────┘
      `);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does a SELECT query GROUP BY with CASE', (testComplete) => {
    exec(`bin/plyql -h ${druidHost} -q 'SELECT CASE page WHEN "Jeremy Corbyn" THEN "Labor" ELSE "Other" END AS casePage, SUM(count) AS 'Count' FROM wikipedia WHERE channel = "en" GROUP BY 1 ORDER BY Count DESC LIMIT 3;'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain(sane`
        ┌──────────┬────────┐
        │ casePage │ Count  │
        ├──────────┼────────┤
        │ Other    │ 114470 │
        │ Labor    │ 241    │
        └──────────┴────────┘
      `);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does a SELECT query with empty result', (testComplete) => {
    exec(`bin/plyql -h ${druidHost} -q 'SELECT page, SUM(count) AS 'Count' FROM wikipedia WHERE channel = "blah" GROUP BY page ORDER BY Count DESC LIMIT 3;'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain(sane`
        ┌──────┬───────┐
        │ page │ Count │
        └──────┴───────┘
      `);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does a SELECT query with NULL', (testComplete) => {
    exec(`bin/plyql -h ${druidHost} -q 'SELECT cityName FROM wikipedia GROUP BY 1 LIMIT 3;'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain(sane`
        ┌────────────┐
        │ cityName   │
        ├────────────┤
        │ NULL       │
        │ 'Ewa Beach │
        │ A Coruña   │
        └────────────┘
      `);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does a SHOW TABLES query', (testComplete) => {
    exec(`bin/plyql -h ${druidHost} -q 'SHOW TABLES' -o JSON`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(parseLineJson(stdout)).to.deep.equal([
        {
          "Tables_in_database": "COLUMNS"
        },
        {
          "Tables_in_database": "SCHEMATA"
        },
        {
          "Tables_in_database": "TABLES"
        },
        {
          "Tables_in_database": "wikipedia"
        },
        {
          "Tables_in_database": "wikipedia-compact"
        }
      ]);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does timezone conversion query', (testComplete) => {
    exec(`bin/plyql -h ${druidHost} -Z "America/Los_Angeles" -o json -q 'SELECT TIMESTAMP("2016-04-04T01:02:03") AS T'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(parseLineJson(stdout)).to.deep.equal([
        {
          "T": "2016-04-04T08:02:03.000Z"
        }
      ]);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('respects timezone display for table', (testComplete) => {
    exec(`bin/plyql -h ${druidHost} -Z "America/Los_Angeles" -o table -q 'SELECT TIMESTAMP("2016-04-04T01:02:03") AS T'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain(sane`
        ┌───────────────────────────┐
        │ T                         │
        ├───────────────────────────┤
        │ 2016-04-04T01:02:03-07:00 │
        └───────────────────────────┘

      `);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('respects timezone display of range for table', (testComplete) => {
    exec(`bin/plyql -h ${druidHost} -Z "America/Los_Angeles" -o table -q 'SELECT TIME_RANGE(TIMESTAMP("2016-04-04T01:02:03"), P2D) AS T'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain(sane`
        ┌───────────────────────────────────────────────────────┐
        │ T                                                     │
        ├───────────────────────────────────────────────────────┤
        │ [2016-04-04T01:02:03-07:00,2016-04-06T01:02:03-07:00] │
        └───────────────────────────────────────────────────────┘

      `);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('respects timezone display for csv', (testComplete) => {
    exec(`bin/plyql -h ${druidHost} -Z "Asia/Kathmandu" -o csv -q 'SELECT TIMESTAMP("2016-04-04T01:02:03") AS T'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain(sane`
      2016-04-04T01:02:03+05:45
    `);
      expect(stderr).to.equal('');
      testComplete();
    });
  });


  it('respects timezone display for tsv', (testComplete) => {
    exec(`bin/plyql -h ${druidHost} -Z "Asia/Kathmandu" -o tsv -q 'SELECT TIMESTAMP("2016-04-04T01:02:03") AS T'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain(sane`
      2016-04-04T01:02:03+05:45
    `);
      expect(stderr).to.equal('');
      testComplete();
    });
  });


  it('passes in a custom druid context', (testComplete) => {
    exec(`bin/plyql -h ${druidHost} -v --druid-context '{"lol":1}' -q "SELECT COUNT(DISTINCT user_theta) FROM wikipedia";`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain('"lol": 1');
      expect(stdout).to.contain(sane`
        ┌────────────────────────────┐
        │ COUNT(DISTINCT user_theta) │
        ├────────────────────────────┤
        │ 38164.49404386297          │
        └────────────────────────────┘

      `);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('makes a case insensitive query', () => {
    return Q.nfcall(exec, `bin/plyql -h ${druidHost} -q 'SELECT pAgE as PAGE from wikipedia WHERE PAGE > "W" AND PAGE < "Y" limit 5' -o JSON`)
      .then((res) => {
        expect(parseLineJson(res[0])).to.deep.equal([
          {
            "PAGE": "Wikipedia talk:WikiProject Arts"
          },
          {
            "PAGE": "Winthrop, Maine"
          },
          {
            "PAGE": "Wikipedia:Articles for deletion/Log/2015 September 12"
          },
          {
            "PAGE": "Wikipedia:Articles for deletion/Log/2015 September 4"
          },
          {
            "PAGE": "Wikipedia:Articles for deletion/Dmitry Geller"
          }
        ]);
      });
  });

  it('does a group by query and respects order', () => {
    return Q.nfcall(exec, `bin/plyql -h ${druidHost} -q 'SELECT sum(added), page from wikipedia group by 2 limit 5'`)
      .then((res) => {
        expect(res[0]).to.contain(sane`
          ┌────────────┬─────────────────────────────────┐
          │ sum(added) │ page                            │
          ├────────────┼─────────────────────────────────┤
          │ 1940       │ !T.O.O.H.!                      │
          │ 68         │ "The Secret Life of..."         │
          │ 4717       │ '''Kertomus Venetsiasta''' 1977 │
          │ 1612       │ 'Ajde Jano                      │
          │ 30         │ 'Alî Sharî'atî                  │
          └────────────┴─────────────────────────────────┘
        `)
      });
  });

  it('respects bounds', () => {
    return Q.nfcall(exec,
      `bin/plyql -h ${druidHost} -q 'SELECT count(*) FROM wikipedia WHERE __time BETWEEN "2015-09-12 00:46:00" AND "2015-09-12 00:48:00"'`
    ).then((res) => {
      expect(res[0]).to.contain('409')
    });
  });

  it('works with custom transforms from command line', () => {
    // Note: String.fromCharCode(46) === "." and String.fromCharCode() === ""
    // Figuring out escaping is too hard
    let ct = `{
      "dotify": {
        "extractionFn": {
          "type": "javascript",
          "function": "function(v) { return String(v).split(String.fromCharCode()).join(String.fromCharCode(46)); }"
        }
      }
    }`;

    return Q.nfcall(exec,
        `bin/plyql -h ${druidHost} --custom-transforms '${ct}' -q 'SELECT CUSTOM_TRANSFORM(page, dotify), COUNT(*) FROM wikipedia GROUP BY 1 LIMIT 5'`
      )
      .then((res) => {
        expect(res[0]).to.contain(".T.h.e. .S.e.c.r.e.t. .L.i.f.e. .o.f.......");
      })
  });

  it('works with custom transforms from file', () => {
    return Q.nfcall(exec,
      `bin/plyql -h ${druidHost} --custom-transforms @test/utils/custom/fancy-transforms.json -q 'SELECT CUSTOM_TRANSFORM(page, dotify), COUNT(*) FROM wikipedia GROUP BY 1 LIMIT 5'`
    )
      .then((res) => {
        expect(res[0]).to.contain(".T.h.e. .S.e.c.r.e.t. .L.i.f.e. .o.f.......");
      })
  });

  it('works with custom aggregations from file', () => {
    return Q.nfcall(exec,
      `bin/plyql -h ${druidHost} --custom-aggregations @test/utils/custom/fancy-aggregations.json -q 'SELECT channel, CUSTOM_AGGREGATE("addedMod1337") FROM wikipedia GROUP BY 1 LIMIT 5'`
    )
      .then((res) => {
        expect(res[0]).to.contain("1097");
      })
  });

  it('makes a describe existing table', () => {
    return Q.nfcall(exec, `bin/plyql -h ${druidHost} -q 'DESCRIBE wikipedia' -o JSON`)
      .then((res) => {
        expect(parseLineJson(res[0])).to.deep.equal([
          {
            "Default": null,
            "Extra": "",
            "Field": "__time",
            "Key": "",
            "Null": "YES",
            "Type": "TIME"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "added",
            "Key": "",
            "Null": "YES",
            "Type": "NUMBER"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "channel",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "cityName",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "comment",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "commentLength",
            "Key": "",
            "Null": "YES",
            "Type": "NUMBER"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "commentLengthStr",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "count",
            "Key": "",
            "Null": "YES",
            "Type": "NUMBER"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "countryIsoCode",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "countryName",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "deleted",
            "Key": "",
            "Null": "YES",
            "Type": "NUMBER"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "delta",
            "Key": "",
            "Null": "YES",
            "Type": "NUMBER"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "deltaBucket100",
            "Key": "",
            "Null": "YES",
            "Type": "NUMBER"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "deltaByTen",
            "Key": "",
            "Null": "YES",
            "Type": "NUMBER"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "delta_hist",
            "Key": "",
            "Null": "YES",
            "Type": "NULL"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "isAnonymous",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "isMinor",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "isNew",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "isRobot",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "isUnpatrolled",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "max_delta",
            "Key": "",
            "Null": "YES",
            "Type": "NUMBER"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "metroCode",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "min_delta",
            "Key": "",
            "Null": "YES",
            "Type": "NUMBER"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "namespace",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "page",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "page_unique",
            "Key": "",
            "Null": "YES",
            "Type": "NULL"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "regionIsoCode",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "regionName",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "sometimeLater",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "sometimeLaterMs",
            "Key": "",
            "Null": "YES",
            "Type": "NUMBER"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "user",
            "Key": "",
            "Null": "YES",
            "Type": "STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "userChars",
            "Key": "",
            "Null": "YES",
            "Type": "SET/STRING"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "user_theta",
            "Key": "",
            "Null": "YES",
            "Type": "NULL"
          },
          {
            "Default": null,
            "Extra": "",
            "Field": "user_unique",
            "Key": "",
            "Null": "YES",
            "Type": "NULL"
          }
        ]);
      })
  });

  it('makes a describe non-existing table', () => {
    return Q.nfcall(exec, `bin/plyql -h ${druidHost} -q 'DESCRIBE wikiplebia' -o JSON`)
      .then(() => {
        throw new Error('DID_NOT_ERROR');
      })
      .catch((e) => {
        expect(e.message).to.contain('No such datasource');
      })
  });

});
