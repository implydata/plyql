const { expect } = require('chai');
const { spawn, exec } = require('child_process');
const { readdirSync } = require('fs');
const { sane } = require('./utils.js');

const TEST_PORT = 13307;

var child;

var jars = readdirSync('test/jdbc/jar');
if (!jars.length) throw new Error("must have at least one jar in 'test/jdbc/jar'");

// jars = ['mysql-connector-java-6.0.2.jar'];

describe('mysql-gateway-mysql-client', function() {
  this.timeout(10000);

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

  for (var jar of jars) {
    it(`does basic query on ${jar}`, (testComplete) => {
      exec(`java -cp test/jdbc/jar/${jar}:test/jdbc/ DruidQuery "jdbc:mysql://127.0.0.1:${TEST_PORT}/plyql1"`, (error, stdout, stderr) => {
        expect(error).to.equal(null);
        //console.log('stderr', stderr);
        expect(stdout).to.contain(sane`
          Time[2015-09-11 17:00:00.0] Channel[en] Count[104870] Added[231369.562500]
          Time[2015-09-11 17:00:00.0] Channel[vi] Count[98862] Added[29220.669922]
          Time[2015-09-11 17:00:00.0] Channel[de] Count[23833] Added[40796.171875]
          Time[2015-09-11 17:00:00.0] Channel[fr] Count[19064] Added[41101.738281]
          Time[2015-09-11 17:00:00.0] Channel[ru] Count[12841] Added[34958.781250]
        `);
        //expect(stderr).to.equal('');
        testComplete();
      });
    });
  }

  it(`does same query on real MySQL ${jar}`, (testComplete) => {
    exec(`java -cp test/jdbc/jar/${jar}:test/jdbc/ DruidQuery "jdbc:mysql://192.168.99.100:3306/datazoo?user=root"`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      //console.log('stderr', stderr);
      expect(stdout).to.contain(sane`
        Time[2015-09-11 17:00:00.0] Channel[en] Count[104870] Added[231369.562500]
        Time[2015-09-11 17:00:00.0] Channel[vi] Count[98862] Added[29220.669922]
        Time[2015-09-11 17:00:00.0] Channel[de] Count[23833] Added[40796.171875]
        Time[2015-09-11 17:00:00.0] Channel[fr] Count[19064] Added[41101.738281]
        Time[2015-09-11 17:00:00.0] Channel[ru] Count[12841] Added[34958.781250]
      `);
      //expect(stderr).to.equal('');
      testComplete();
    });
  });

  after(() => {
    child.kill('SIGHUP');
  });

});
