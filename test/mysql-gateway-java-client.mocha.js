const { expect } = require('chai');
const { spawn, exec } = require('child_process');
const { readdirSync } = require('fs');
const { sane } = require('./utils.js');

const TEST_PORT = 3307;

var child;

var jars = readdirSync('test/jdbc/jar');

describe('mysql-gateway-mysql-client', () => {
  before((done) => {
    exec('javac test/jdbc/DruidQuery.java', (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stderr).to.equal('');

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

  });

  for (var jar of jars) {
    it(`does basic query on ${jar}`, (testComplete) => {
      exec(`java -cp test/jdbc/jar/${jar}:test/jdbc/ DruidQuery`, (error, stdout, stderr) => {
        expect(error).to.equal(null);
        expect(stdout).to.contain(sane`
          page[Jeremy Corbyn] count[314]
          page[User:Cyde/List of candidates for speedy deletion/Subpage] count[255]
          page[Wikipedia:Administrators' noticeboard/Incidents] count[228]
          page[Wikipedia:Vandalismusmeldung] count[186]
          page[Total Drama Presents: The Ridonculous Race] count[160]
          page[Wikipedia:Administrator intervention against vandalism] count[145]
          page[Flavia Pennetta] count[141]
          page[Wikipedia:Requests for page protection] count[132]
          page[Wikipédia:Le Bistro/12 septembre 2015] count[130]
          page[List of shipwrecks in August 1944] count[129]
          page[Wikipedia:Auskunft] count[127]
          page[Wikipedia:In the news/Candidates] count[126]
          page[Wikipedia:Prośby o przejrzenie edycji] count[126]
          page[Wikipedia:Files for deletion/2015 September 12] count[122]
          page[Wikipedia:Adminkandidaturen/Nicola III] count[115]
      `);
        //expect(stderr).to.equal('');
        testComplete();
      });
    });
  }

  after(() => {
    child.kill('SIGHUP');
  });

});
