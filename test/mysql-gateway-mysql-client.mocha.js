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
const { spawn, exec } = require('child_process');
const { sane } = require('./utils/utils.js');

var TEST_PORT = 13307;
var CONN = `--host=127.0.0.1 --port=${TEST_PORT}`;
//CONN = `--host=192.168.99.100 -u root`; // Real datazoo MySQL

var child;

describe('mysql-gateway-mysql-client', () => {
  before((done) => {
    child = spawn('bin/plyql', `-h 192.168.99.100 -i P2Y --experimental-mysql-gateway ${TEST_PORT}`.split(' '));

    child.stderr.on('data', (data) => {
      throw new Error(data.toString());
    });

    child.stdout.on('data', (data) => {
      data = data.toString();
      //console.log('GATEWAY:', data);
      if (data.indexOf(`port: ${TEST_PORT}`) !== -1) {
        done();
      }
    });

  });

  it('does basic query', (testComplete) => {
    exec(`mysql ${CONN} -e 'SELECT 1+1'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain(sane`
        1+1
        2
      `);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does basic query with NULL', (testComplete) => {
    exec(`mysql ${CONN} -e 'SELECT NULL as LOL'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain('NULL');
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does basic query with boolean', (testComplete) => {
    exec(`mysql ${CONN} -e 'SELECT 2=2'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain('1');
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does a SELECT query', (testComplete) => {
    exec(`mysql ${CONN} -e 'SELECT page, SUM(count) AS 'Count' FROM wikipedia WHERE channel = "en" GROUP BY page ORDER BY Count DESC LIMIT 3;'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain('User:Cyde/List of candidates for speedy deletion/Subpage');
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does a SELECT variables query', (testComplete) => {
    exec(`mysql ${CONN} -t -e 'SELECT @@session.auto_increment_increment, @@character_set_client, @@character_set_connection, @@character_set_results, @@character_set_server, @@init_connect, @@interactive_timeout, @@license, @@lower_case_table_names, @@max_allowed_packet, @@net_buffer_length, @@net_write_timeout, @@query_cache_size, @@query_cache_type, @@sql_mode, @@system_time_zone, @@time_zone, @@tx_isolation, @@wait_timeout;'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout.replace(/\t/g, '|')).to.equal(sane`
        +--------------------------+----------------------+--------------------------+-----------------------+----------------------+--------------+---------------------+------------+------------------------+--------------------+-------------------+-------------------+------------------+------------------+-------------------------------------------------------------------------------------------------------------------------------------------+------------------+-----------+-----------------+--------------+
        | auto_increment_increment | character_set_client | character_set_connection | character_set_results | character_set_server | init_connect | interactive_timeout | license    | lower_case_table_names | max_allowed_packet | net_buffer_length | net_write_timeout | query_cache_size | query_cache_type | sql_mode                                                                                                                                  | system_time_zone | time_zone | tx_isolation    | wait_timeout |
        +--------------------------+----------------------+--------------------------+-----------------------+----------------------+--------------+---------------------+------------+------------------------+--------------------+-------------------+-------------------+------------------+------------------+-------------------------------------------------------------------------------------------------------------------------------------------+------------------+-----------+-----------------+--------------+
        |                        1 | utf8mb4              | utf8mb4                  | utf8mb4               | utf8mb4              |            0 |               28800 | Apache-2.0 |                      0 |            4194304 |             16384 |                60 |          1048576 |                0 | ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION | UTC              | UTC       | REPEATABLE-READ |        28800 |
        +--------------------------+----------------------+--------------------------+-----------------------+----------------------+--------------+---------------------+------------+------------------------+--------------------+-------------------+-------------------+------------------+------------------+-------------------------------------------------------------------------------------------------------------------------------------------+------------------+-----------+-----------------+--------------+
      
      `);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it.skip('does a SHOW WARNINGS query', (testComplete) => {
    exec(`mysql ${CONN} -t -e 'SHOW WARNINGS'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.equal('');
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  after(() => {
    child.kill('SIGHUP');
  });

});
