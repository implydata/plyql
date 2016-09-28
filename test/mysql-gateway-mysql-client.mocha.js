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
const spawnServer = require('node-spawn-server');

var TEST_PORT = 13307;
var CONN = `--host=127.0.0.1 --port=${TEST_PORT}`;
//CONN = `--host=192.168.99.100 -u root`; // Real datazoo MySQL

var child;

describe('mysql-gateway-mysql-client', function() {
  before((done) => {
    child = spawnServer(`bin/plyql -h 192.168.99.100 --experimental-mysql-gateway ${TEST_PORT}`);
    child.onHook(`port: ${TEST_PORT}`, done);
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

  var assert = (name, query, stdOutFn, complete) => {
    exec(`mysql ${CONN} -e "${query}"`, (error, stdout, stderr) => {
      expect(error, name).to.equal(null);
      expect(stdOutFn(stdout), name).to.equal(true);
      expect(stderr, name).to.equal('');
      if (complete) complete();
    });
  };

  it('regression tests, information schema', (testComplete) => {
    var query1 = sane`
      SELECT table_name, column_name
      FROM information_schema.COLUMNS
      WHERE data_type='' AND table_schema=''
    `;
    var query2 = sane`
      SELECT table_name, column_name
      FROM information_schema.COLUMNS
      WHERE data_type='enum' AND table_schema='plyql1'
    `;

    var query2Lower = sane`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE data_type='enum' AND table_schema='plyql1'
    `;

    var query3 = sane`
      SELECT table_collation FROM information_schema.TABLES WHERE table_name='wikipedia'
    `;

    var query3Lower = sane`
      SELECT table_collation FROM information_schema.tables WHERE table_name='wikipedia'
    `;

    var query4 = sane`
      DESCRIBE wikipedia
    `;

    assert('information schema.columns 1', query1, (stdOut) => stdOut === '');
    assert('information schema.columns 2', query2, (stdOut) => stdOut === '');
    assert('information schema.columns 2 lower', query2Lower, (stdOut) => stdOut === '');

    assert('information schema.tables', query3, (stdOut) => stdOut.indexOf('utf8_general_ci') !== -1);
    assert('information schema.tables lower', query3Lower, (stdOut) => stdOut.indexOf('utf8_general_ci') !== -1);

    assert('describe', query4, (stdOut) => {
      return stdOut.indexOf('Field	Type	Null	Key	Default	Extra') !== -1 &&
        stdOut.indexOf('isAnonymous	varchar(255)	YES		NULL') !== -1;
    }, testComplete)
  });

  it.skip('quarters', (testComplete) => {
    var quarter = sane`
      SELECT QUARTER(wikipedia.__time) AS qr___time_ok,
      SUM(wikipedia.added) AS sum_added_ok
      FROM wikipedia
      GROUP BY 1
    `;

    assert('information schema.columns 1', quarter, (stdOut) => stdOut.indexOf(sane`
      qr___time_ok	sum_added_ok
      3	97393744
      `) !== -1, testComplete);

    var quarterWithYear = sane`
    SELECT SUM(wikipedia.added) AS sum_added_ok,
    ADDDATE( CONCAT(
              DATE_FORMAT( wikipedia.__time, '%Y-' ),
              (3*(QUARTER(wikipedia.__time)-1)+1), '-01 00:00:00' ),
              INTERVAL 0 SECOND )
      AS tqr___time_ok
    FROM wikipedia
    GROUP BY 2
    `;
  });

  after(() => {
    child.kill('SIGHUP');
  });

});
