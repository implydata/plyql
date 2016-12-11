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
const { readdirSync } = require('fs');
const { sane } = require('./utils/utils.js');

const TEST_PORT = 13307;

let child;

let jars = readdirSync('test/jdbc/jar');
jars = jars.filter((file) => /\.jar$/.test(file));
if (!jars.length) throw new Error("must have at least one jar in 'test/jdbc/jar'");

// jars = ['mysql-connector-java-5.1.39.jar'];

describe('mysql-gateway-java-client', function() {
  this.timeout(20000);

  before((done) => {
    exec('javac test/jdbc/DruidQuery.java', (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stderr).to.equal('');

      child = spawn('bin/plyql', `-h 192.168.99.100 -i P2Y --druid-time-attribute time --force-boolean isNew --experimental-mysql-gateway ${TEST_PORT}`.split(' '));

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

  });

  jars.forEach((jar) => {
    it(`does basic query on ${jar}`, (testComplete) => {
      exec(`java -cp test/jdbc/jar/${jar}:test/jdbc/ DruidQuery "jdbc:mysql://127.0.0.1:${TEST_PORT}/plyql1"`, (error, plyqlStdout, stderr) => {
        expect(error).to.equal(null);
        expect(stderr).to.not.contain('at DruidQuery.main(');

        exec(`java -cp test/jdbc/jar/${jar}:test/jdbc/ DruidQuery "jdbc:mysql://192.168.99.100:3306/datazoo?user=root"`, (error, mysqlStdout, stderr) => {
          expect(error).to.equal(null);
          expect(plyqlStdout).to.equal(mysqlStdout);
          //expect(stderr).to.equal('');
          testComplete();
        });
      });
    });
  });

  after(() => {
    child.kill('SIGHUP');
  });

});
