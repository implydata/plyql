const { expect } = require('chai');
const { spawn, exec } = require('child_process');
const { sane } = require('./utils.js');

const TEST_PORT = 13307;

var child;

describe('mysql-gateway-with-client', () => {
  before((done) => {
    child = spawn('bin/plyql', `-h 192.168.99.100 -i P2Y --experimental-mysql-gateway ${TEST_PORT}`.split(' '));

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

  it('does basic query', (testComplete) => {
    exec(`mysql --host=127.0.0.1 --port=${TEST_PORT} -e 'SELECT 1+1'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain(sane`
        1+1
        2
      `);
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('does a SELECT query', (testComplete) => {
    exec(`mysql --host=127.0.0.1 --port=${TEST_PORT} -e 'SELECT page, Count(*) AS 'Count' FROM wikipedia WHERE channel = "en" GROUP BY page ORDER BY Count DESC LIMIT 3;'`, (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain('User:Cyde/List of candidates for speedy deletion/Subpage');
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  after(() => {
    child.kill('SIGHUP');
  });

});
