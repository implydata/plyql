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
const { spawn } = require('child_process');
const request = require('request');

const { $, ply, r } = require('plywood');

const TEST_PORT = 18082;

var child;

describe('json-server', function() {
  this.timeout(10000);

  before((done) => {
    child = spawn('bin/plyql', `-h 192.168.99.100 -i P2Y --json-server ${TEST_PORT}`.split(' '));

    child.stderr.on('data', (data) => {
      throw new Error(data.toString());
    });

    child.stdout.on('data', (data) => {
      data = data.toString();
      if (data.indexOf(`port: ${TEST_PORT}`) !== -1) {
        done();
      }
    });
  });

  it('works with GET /health', (testComplete) => {
    request.get(`http://localhost:${TEST_PORT}/health`, (err, response, body) => {
      expect(err).to.equal(null);
      expect(body).to.contain('I am healthy @');
      testComplete();
    });
  });

  it('works with basic query', (testComplete) => {
    request.post({
      url: `http://localhost:${TEST_PORT}/plyql`,
      json: {
        sql: 'SELECT 1+1 as test'
      }
    }, (err, response, body) => {
       expect(err).to.equal(null);
       expect(body.result).to.deep.equal([
         {
           "test": 2
         }
       ]);
       testComplete();
    });
  });

  it('works with Russian', (testComplete) => {
    request.post({
      url: `http://localhost:${TEST_PORT}/plyql`,
      json: {
        sql: 'SELECT "Которувоч" as test'
      }
    }, (err, response, body) => {
      expect(err).to.equal(null);
      expect(body.result).to.deep.equal([
        {
          "test": "Которувоч"
        }
      ]);
      testComplete();
    });
  });

  it('works complex query', (testComplete) => {
    request.post({
      url: `http://localhost:${TEST_PORT}/plyql`,
      json: {
        sql: `SELECT page, SUM(count) AS 'Count' FROM wikipedia WHERE channel = "en" GROUP BY page ORDER BY Count DESC LIMIT 3;`
      }
    }, (err, response, body) => {
      expect(err).to.equal(null);
      expect(body.result).to.deep.equal([
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
      ]);
      testComplete();
    });
  });

  it('works with can not parse error', (testComplete) => {
    request.post({
      url: `http://localhost:${TEST_PORT}/plyql`,
      json: {
        sql: `SELECT FROMZY WOMZY GOUPZY POPZY`
      }
    }, (err, response, body) => {
      expect(err).to.equal(null);
      expect(response.statusCode).to.equal(400);
      expect(body.error).to.contain('SQL parse error');
      testComplete();
    });
  });

  it('works with unsupported verb error', (testComplete) => {
    request.post({
      url: `http://localhost:${TEST_PORT}/plyql`,
      json: {
        sql: `USE drugs`
      }
    }, (err, response, body) => {
      expect(err).to.equal(null);
      expect(response.statusCode).to.equal(400);
      expect(body.error).to.contain('Unsupported SQL verb USE');
      testComplete();
    });
  });

  it('works with general compute error', (testComplete) => {
    request.post({
      url: `http://localhost:${TEST_PORT}/plyql`,
      json: {
        sql: `SELECT page, SUM(count) AS 'Count' FROM wikipediaz WHERE channel = "en" GROUP BY page ORDER BY Count DESC LIMIT 3;`
      }
    }, (err, response, body) => {
      expect(err).to.equal(null);
      expect(response.statusCode).to.equal(500);
      expect(body.error).to.contain('could not');
      expect(body.error).to.contain('wikipediaz');
      testComplete();
    });
  });

  it('works complex expression', (testComplete) => {
    var expression = $('wikipedia')
      .filter('$channel == "en"')
      .split('$page', 'Page')
      .apply('Count', '$wikipedia.sum($count)')
      .sort('$Count', 'descending')
      .limit(3);

    request.post({
      url: `http://localhost:${TEST_PORT}/plywood`,
      json: {
        expression: expression.toJS()
      }
    }, (err, response, body) => {
      expect(err).to.equal(null);
      expect(body.result).to.deep.equal([
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
      testComplete();
    });
  });

  after(() => {
    child.kill('SIGHUP');
  });

});
