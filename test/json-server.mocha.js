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
const { spawn } = require('child_process');
const request = require('request');
const spawnServer = require('node-spawn-server');
const Q = require('q');

const { $, ply, r } = require('plywood');

const TEST_PORT = 18082;

let child;
const druidHost = '192.168.99.100';

describe('json-server', () => {
  before((done) => {
    child = spawnServer(`bin/plyql -h ${druidHost} -i P2Y --json-server ${TEST_PORT}`);
    child.onHook(`port: ${TEST_PORT}`, done);
  });

  it('works with GET /health', () => {
    return Q.nfcall(request.get, `http://localhost:${TEST_PORT}/health`)
      .then((res) => {
        expect(res[0].statusCode).to.equal(200);
        let body = res[1];
        expect(body).to.contain('I am healthy @');
      });
  });

  it('works with basic query', () => {
    return Q.nfcall(request.post, {
      url: `http://localhost:${TEST_PORT}/plyql`,
      json: {
        sql: 'SELECT 1+1 as test'
      }
    })
      .then((res) => {
        expect(res[0].statusCode).to.equal(200);
        let body = res[1];
        expect(body.result).to.deep.equal({
          "attributes": [
            {
              "name": "test",
              "type": "NUMBER"
            }
          ],
          "data": [
            {
              "test": 2
            }
          ]
        });
      });
  });

  it('works with Russian', () => {
    return Q.nfcall(request.post, {
        url: `http://localhost:${TEST_PORT}/plyql`,
        json: {
          sql: 'SELECT "Которувоч" as test'
        }
      })
      .then((res) => {
        expect(res[0].statusCode).to.equal(200);
        let body = res[1];
        expect(body.result).to.deep.equal({
          "attributes": [
            {
              "name": "test",
              "type": "STRING"
            }
          ],
          "data": [
            {
              "test": "Которувоч"
            }
          ]
        });
      });
  });

  it('works complex query', () => {
    return Q.nfcall(request.post, {
      url: `http://localhost:${TEST_PORT}/plyql`,
      json: {
        sql: `SELECT page, SUM(count) AS 'Count' FROM wikipedia WHERE channel = "en" GROUP BY page ORDER BY Count DESC LIMIT 3;`
      }
    })
      .then((res) => {
        expect(res[0].statusCode).to.equal(200);
        let body = res[1];
        expect(body.result).to.to.deep.equal({
          "attributes": [
            {
              "name": "page",
              "type": "STRING"
            },
            {
              "name": "Count",
              "type": "NUMBER"
            }
          ],
          "data": [
            {
              "Count": 255,
              "page": "User:Cyde/List of candidates for speedy deletion/Subpage"
            },
            {
              "Count": 241,
              "page": "Jeremy Corbyn"
            },
            {
              "Count": 228,
              "page": "Wikipedia:Administrators' noticeboard/Incidents"
            }
          ],
          "keys": [
            "page"
          ]
        });
      });
  });

  it('works with can not parse error', () => {
    return Q.nfcall(request.post, {
      url: `http://localhost:${TEST_PORT}/plyql`,
      json: {
        sql: `SELECT FROMZY WOMZY GOUPZY POPZY`
      }
    })
      .then((res) => {
        expect(res[0].statusCode).to.equal(400);
        let body = res[1];
        expect(body.error).to.contain('SQL parse error');
      });
  });

  it('works with unsupported verb error', () => {
    return Q.nfcall(request.post, {
      url: `http://localhost:${TEST_PORT}/plyql`,
      json: {
        sql: `USE drugs`
      }
    })
      .then((res) => {
        expect(res[0].statusCode).to.equal(400);
        let body = res[1];
        expect(body.error).to.contain('Unsupported SQL verb USE');
      });
  });


  it('works with general compute error', () => {
    return Q.nfcall(request.post, {
      url: `http://localhost:${TEST_PORT}/plyql`,
      json: {
        sql: `SELECT page, SUM(count) AS 'Count' FROM wikipediaz WHERE channel = "en" GROUP BY page ORDER BY Count DESC LIMIT 3;`
      }
    })
      .then((res) => {
        expect(res[0].statusCode).to.equal(500);
        let body = res[1];
        expect(body.error).to.contain('could not');
        expect(body.error).to.contain('wikipediaz');
      });
  });

  it('works complex expression', () => {
    let expression = $('wikipedia')
      .filter('$channel == "en"')
      .split('$page', 'Page')
      .apply('Count', '$wikipedia.sum($count)')
      .sort('$Count', 'descending')
      .limit(3);

    let options = {
      url: `http://localhost:${TEST_PORT}/plywood`,
      json: {
        expression: expression.toJS()
      }
    };

    return Q.nfcall(request.post, options)
      .then((res) => {
        let body = res[1];
        expect(body.result.data).to.deep.equal([
          {
            "Count": 255,
            "Page": "User:Cyde/List of candidates for speedy deletion/Subpage"
          },
          {
            "Count": 241,
            "Page": "Jeremy Corbyn"
          },
          {
            "Count": 228,
            "Page": "Wikipedia:Administrators' noticeboard/Incidents"
          }
        ]);
      });
  });

  it('works case insensitive expression', () => {
    let expression = $('wikipedia')
      .filter('i$cHannel == "en"')
      .split('i$PaGe', 'Page')
      .apply('Count', '$wikipedia.sum($count)')
      .sort('i$counT', 'descending')
      .limit(3);

    let options = {
      url: `http://localhost:${TEST_PORT}/plywood`,
      json: {
        expression: expression.toJS()
      }
    };

    return Q.nfcall(request.post, options)
      .then((res) => {
        let body = res[1];
        expect(body.result.data).to.deep.equal([
          {
            "Count": 255,
            "Page": "User:Cyde/List of candidates for speedy deletion/Subpage"
          },
          {
            "Count": 241,
            "Page": "Jeremy Corbyn"
          },
          {
            "Count": 228,
            "Page": "Wikipedia:Administrators' noticeboard/Incidents"
          }
        ]);
      });
  });

  after(() => {
    if (child) child.kill();
  });

});
