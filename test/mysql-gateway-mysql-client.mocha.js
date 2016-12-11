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

const TEST_PORT = 13307;
const CONN = `--host=127.0.0.1 --port=${TEST_PORT}`;
//CONN = `--host=192.168.99.100 -u root`; // Real datazoo MySQL

let child;

const assert = (name, query, stdOutFn, complete) => {
  exec(`mysql ${CONN} -e "${query}"`, (error, stdout, stderr) => {
    expect(error, name).to.equal(null);
    expect(stdOutFn(stdout), name).to.equal(true);
    expect(stderr, name).to.equal('');
    if (complete) complete();
  });
};

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

  it('does a show status query', (testComplete) => {
    exec(`mysql ${CONN} -e 'SHOW SESSION STATUS LIKE "Ssl_cipher"'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain('Ssl_cipher');
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does a show character set query', (testComplete) => {
    exec(`mysql ${CONN} -e 'SHOW CHARACTER SET LIKE "%utf%"'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain('Charset	Default collation	Description	Maxlen');
      expect(stdout).to.contain('utf8	utf8_general_ci	UTF-8 Unicode	3');
      expect(stdout).to.contain('utf8mb4	utf8mb4_general_ci	UTF-8 Unicode	4');
      expect(stdout).to.contain('utf16	utf16_general_ci	UTF-16 Unicode	4');
      expect(stdout).to.contain('utf16le	utf16le_general_ci	UTF-16LE Unicode	4');
      expect(stdout).to.contain('utf32	utf32_general_ci	UTF-32 Unicode	4');
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does a show collation query', (testComplete) => {
    exec(`mysql ${CONN} -e 'SHOW COLLATION like "%latin1%"'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain('Collation	Charset	Id	Default	Compiled	Sortlen');
      expect(stdout).to.contain('latin1_german1_ci	latin1	5		Yes	1');
      expect(stdout).to.contain('latin1_swedish_ci	latin1	8	Yes	Yes	1');
      expect(stdout).to.contain('latin1_danish_ci	latin1	15		Yes	1');
      expect(stdout).to.contain('latin1_german2_ci	latin1	31		Yes	2');
      expect(stdout).to.contain('latin1_bin	latin1	47		Yes	1');
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

  it('regression tests, information schema', (testComplete) => {
    let query1 = sane`
      SELECT table_name, column_name
      FROM information_schema.COLUMNS
      WHERE data_type='' AND table_schema=''
    `;
    let query2 = sane`
      SELECT table_name, column_name
      FROM information_schema.COLUMNS
      WHERE data_type='enum' AND table_schema='plyql1'
    `;

    let query2Lower = sane`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE data_type='enum' AND table_schema='plyql1'
    `;

    let query3 = sane`
      SELECT table_collation FROM information_schema.TABLES WHERE table_name='wikipedia'
    `;

    let query3Lower = sane`
      SELECT table_collation FROM information_schema.tables WHERE table_name='wikipedia'
    `;

    let query4 = sane`
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

  it('quarters basic', (testComplete) => {
    let quarter = sane`
      SELECT QUARTER(wikipedia.__time) AS qr___time_ok,
      SUM(wikipedia.added) AS sum_added_ok
      FROM wikipedia
      GROUP BY 1
    `;

    assert('information schema.columns 1', quarter, (stdOut) => stdOut.indexOf(sane`
      qr___time_ok	sum_added_ok
      3	97393744
      `) !== -1, testComplete);
  });

  it('quarters fancy', (testComplete) => {
    let quarterWithYear = sane`
      SELECT SUM(wikipedia.added) AS sum_added_ok,
      ADDDATE( CONCAT(
                DATE_FORMAT( wikipedia.__time, '%Y-' ),
                (3*(QUARTER(wikipedia.__time)-1)+1), '-01 00:00:00' ),
                INTERVAL 0 SECOND )
        AS tqr___time_ok
      FROM wikipedia
      GROUP BY 2
    `;

    assert('quarterWithYear', quarterWithYear, (stdOut) => stdOut.indexOf(sane`
      2015-07-01 00:00:00
      `) !== -1, testComplete);
  });

  it('timezone display basic (no tz provided)', (testComplete) => {
    let query = sane`
      SELECT max(__time) from wikipedia
     `;

    assert('respects timezones (no tz provided)', query, (stdOut) => stdOut.indexOf(sane`
        max(__time)
        2015-09-12 23:59:00
      `) !== -1, testComplete
    );
  });

  it('timezone display range (no tz provided)', (testComplete) => {
    let query = sane`
      SELECT TIME_BUCKET(__time, 'P1D') AS V from wikipedia GROUP BY 1
     `;

    assert('respects timezones (no tz provided)', query, (stdOut) => stdOut.indexOf(sane`
        V
        2015-09-12 00:00:00
      `) !== -1, testComplete
    );
  });

  after(() => {
    child.kill('SIGHUP');
  });

});

describe('timezones', function() {
  this.timeout(50000);
  before((done) => {
    child = spawnServer(`bin/plyql -h 192.168.99.100 -Z Asia/Kathmandu --experimental-mysql-gateway ${TEST_PORT}`);
    child.onHook(`port: ${TEST_PORT}`, done);
 });


  it('timezone display basic (tz different from above)', (testComplete) => {
    let query = sane`
      SELECT max(__time) from wikipedia
     `;

    assert('respects timezones (different from above)', query, (stdOut) => stdOut.indexOf(sane`
        max(__time)
        2015-09-13 05:44:00
      `) !== -1, testComplete
    );
  });

  it('timezone display range (tz different from above)', (testComplete) => {
    let query = sane`
      SELECT TIME_BUCKET(__time, 'P1D') AS V from wikipedia GROUP BY 1
     `;

    assert('respects timezones (different from above)', query, (stdOut) => stdOut.indexOf(sane`
        V
        2015-09-12 00:00:00
        2015-09-13 00:00:00
      `) !== -1, testComplete
    );
  });

  after(() => {
    child.kill('SIGHUP');
  });

});
