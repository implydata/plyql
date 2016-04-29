const { expect } = require('chai');
const { spawn } = require('child_process');
const mysql = require('mysql2');

const TEST_PORT = 13307;

var child;
var connection;

describe('mysql-facade', () => {
  before((done) => {
    child = spawn('bin/plyql', `-h 192.168.99.100 -i P2Y --experimental-mysql-facade ${TEST_PORT}`.split(' '));

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
    connection.query(`SELECT page, Count(*) AS 'Count' FROM wikipedia WHERE channel = "en" GROUP BY page ORDER BY Count DESC LIMIT 3;`, (err, res) => {
      expect(err).to.equal(null);
      expect(res).to.deep.equal([
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
