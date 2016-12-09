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

const { expect } = require('chai');
const { sane } = require('./utils/utils.js');
const { exec } = require('child_process');
const Q = require('q');

const druidHost = '192.168.99.100';

describe('query', function() {
  this.timeout(5000);

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
      expect(JSON.parse(stdout)).to.deep.equal([
        {
          "1+1": 2
        }
      ]);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does a SELECT query', (testComplete) => {
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
      expect(JSON.parse(stdout)).to.deep.equal([
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
      expect(JSON.parse(stdout)).to.deep.equal([
        {
          "T": {
            "type": "TIME",
            "value": "2016-04-04T08:02:03.000Z"
          }
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

  it('makes a case insensitive query', () => Q.nfcall(exec,
    `bin/plyql -h ${druidHost} -q 'SELECT pAgE as PAGE from wikipedia WHERE PAGE > "W" AND PAGE < "Y" limit 5' -o JSON`
    )
    .then((res) => {
      expect(JSON.parse(res[0])).to.deep.equal([
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
    })
  );

  it('does a group by query and respects order', () => Q.nfcall(exec,
    `bin/plyql -h ${druidHost} -q 'SELECT sum(added), page from wikipedia group by 2 limit 5'`
    ).then((res) => {
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
      `)}
    )
  );

  it('respects bounds', () => Q.nfcall(exec,
    `bin/plyql -h ${druidHost} -q 'SELECT count(*) FROM wikipedia WHERE __time BETWEEN "2015-09-12 00:46:00" AND "2015-09-12 00:48:00"'`
    ).then((res) => {
      expect(res[0]).to.contain('409')
    })
  );

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
        `bin/plyql -h ${druidHost} --custom-transforms '${ct}' -q 'SELECT CUSTOM_TRANSFORM(page, dotify) FROM wikipedia GROUP BY 1 LIMIT 5'`
      )
      .then((res) => {
        expect(res[0]).to.contain(".T.h.e. .S.e.c.r.e.t. .L.i.f.e. .o.f.......");
      })
    }
  );

  it('works with custom transforms from file', () => {
      return Q.nfcall(exec,
        `bin/plyql -h ${druidHost} --custom-transforms @test/utils/custom/fancy-transforms.json -q 'SELECT CUSTOM_TRANSFORM(page, dotify) FROM wikipedia GROUP BY 1 LIMIT 5'`
      )
        .then((res) => {
          expect(res[0]).to.contain(".T.h.e. .S.e.c.r.e.t. .L.i.f.e. .o.f.......");
        })
    }
  );

  it('works with custom aggregations from file', () => {
      return Q.nfcall(exec,
        `bin/plyql -h ${druidHost} --custom-aggregations @test/utils/custom/fancy-aggregations.json -q 'SELECT channel, CUSTOM_AGGREGATE("addedMod1337") FROM wikipedia GROUP BY 1 LIMIT 5'`
      )
        .then((res) => {
          expect(res[0]).to.contain("1097");
        })
    }
  );

});
