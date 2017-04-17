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
const mysql = require('vogievetsky-mysql2');

const TEST_PORT = 13307;

let child;
let connection;

describe('mysql-gateway-node-client', () => {
  before((done) => {
    child = spawn('bin/plyql', `-h 192.168.99.100 -i P2Y --experimental-mysql-gateway ${TEST_PORT}`.split(' '));

    child.stderr.on('data', (data) => {
      throw new Error(data.toString());
    });

    child.stdout.on('data', (data) => {
      data = data.toString();
      if (data.indexOf(`port: ${TEST_PORT}`) !== -1) {
        connection = mysql.createConnection({
          port: 13307,
          database: 'plywood',
          user: 'root',
          password: ''
        });

        connection.on('error', (err) => {
          // nothing to do here, have a noop function to prevent the error form being thrown
        });

        done();
      }
    });

  });

  it('works with basic query', (testComplete) => {
    connection.query('SELECT 1+1 as test', (err, res) => {
      expect(err).to.equal(null);
      expect(res).to.deep.equal([
        {
          "test": 2
        }
      ]);
      testComplete();
    });
  });

  it('works with Russian', (testComplete) => {
    connection.query('SELECT "Которувоч" as test', (err, res) => {
      expect(err).to.equal(null);
      expect(res).to.deep.equal([
        {
          "test": "Которувоч"
        }
      ]);
      testComplete();
    });
  });

  it('works complex query', (testComplete) => {
    connection.query(`SELECT page, SUM(count) AS 'Count' FROM wikipedia WHERE channel = N'en' GROUP BY page ORDER BY Count DESC LIMIT 3;`, (err, res) => {
      expect(err).to.equal(null);
      expect(res).to.deep.equal([
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

  it('works with normal variable query', (testComplete) => {
    connection.query(`SELECT VARIABLE_NAME AS Variable_name, VARIABLE_VALUE AS Value FROM GLOBAL_VARIABLES WHERE VARIABLE_NAME = "character_set_client";`, (err, res) => {
      expect(err).to.equal(null);
      expect(res).to.deep.equal([
        {
          "Value": "utf8mb4",
          "Variable_name": "character_set_client"
        }
      ]);
      testComplete();
    });
  });

  it('works with variable query @@ style', (testComplete) => {
    connection.query(`SELECT  @@session.auto_increment_increment AS auto_increment_increment, @@character_set_client AS character_set_client;`, (err, res) => {
      expect(err).to.equal(null);
      expect(res).to.deep.equal([
        {
          "auto_increment_increment": 1,
          "character_set_client": "utf8mb4"
        }
      ]);
      testComplete();
    });
  });

  after(() => {
    child.kill('SIGHUP');
  });

});
