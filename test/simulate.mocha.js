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
const { exec } = require('child_process');
const Q = require('q');

const mockDruid = require('./utils/mock-druid');
const queryResult = require('./utils/test-data/wiki-query-responses').result;
const { sane } = require('./utils/utils.js');

const druidHost = 'localhost';
const TEST_PORT = 28082;
let druidServer = null;

function startMockDruid() {
  return Q(mockDruid({
    onQuery: (query) => {
      let queryType = query.queryType;
      if (queryResult[queryType]) return queryResult[queryType];
      throw new Error(`unknown query ${queryType}`);
    },
    onDataSources: () => {
      return {
        json: ['wikipedia', 'wikipedia-compact']
      }
    }
  }));
}

describe('simulate', () => {
  before((done) => {
    startMockDruid().then((d) => {
      druidServer = d;
      done()
    })
  });

  it('does a basic query', () => Q.nfcall(exec,
    `bin/plyql -h ${druidHost}:${TEST_PORT} -q 'SELECT 1+1'`
  ).then((res) => {
      expect(res[0]).to.contain(sane`
        ┌─────┐
        │ 1+1 │
        ├─────┤
        │ 2   │
        └─────┘
      `)}
      )
  );


  it('does basic query with json output', (testComplete) => {
    exec(`bin/plyql -h ${druidHost}:${TEST_PORT} -o json -q 'SELECT 1+1'`, (error, stdout, stderr) => {
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

  it('does a topN query (group by with limit)', () => Q.nfcall(exec,
    `bin/plyql -h ${druidHost}:${TEST_PORT} -q 'select channel from wikipedia group by channel limit 3;'`
    ).then((res) => {
      expect(res[0]).to.contain(sane`
        ┌─────────┐
        │ channel │
        ├─────────┤
        │ ar      │
        │ be      │
        │ bg      │
        └─────────┘
      `)}
    )
  );

  it('does a SHOW TABLES query', (testComplete) => {
    exec(`bin/plyql -h ${druidHost}:${TEST_PORT} -q 'SHOW TABLES' -o JSON`, (error, stdout, stderr) => {
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
    exec(`bin/plyql -h ${druidHost}:${TEST_PORT} -Z "America/Los_Angeles" -o json -q 'SELECT TIMESTAMP("2016-04-04T01:02:03") AS T'`, (error, stdout, stderr) => {
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

  it('passes in a custom druid context', (testComplete) => {
    exec(`bin/plyql -h ${druidHost}:${TEST_PORT} -v --druid-context '{"lol":1}' -q "SELECT COUNT(DISTINCT user_theta) FROM wikipedia";`, (error, stdout, stderr) => {
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

  after(() => {
    if (druidServer) druidServer.kill();
  });
});
