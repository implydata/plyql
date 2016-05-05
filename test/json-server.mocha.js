const { expect } = require('chai');
const { spawn } = require('child_process');
const request = require('request');

const TEST_PORT = 18082;

var child;

describe('json-server', () => {
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

  it('works with GET health', (testComplete) => {
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
        sql: `SELECT page, Count(*) AS 'Count' FROM wikipedia WHERE channel = "en" GROUP BY page ORDER BY Count DESC LIMIT 3;`
      }
    }, (err, response, body) => {
      expect(err).to.equal(null);
      expect(body.result).to.deep.equal([
        {
          "Count": 255,
          "page": "User:Cyde/List of candidates for speedy deletion/Subpage"
        },
        {
          "Count": 238,
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

  after(() => {
    child.kill('SIGHUP');
  });

});
