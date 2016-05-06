const { expect } = require('chai');
const { exec } = require('child_process');

describe('basics', () => {
  it('shows help', (testComplete) => {
    exec('bin/plyql', (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain('Usage: plyql [options]');
      expect(stderr).to.equal('');
      testComplete();
    });
  });

  it('shows version', (testComplete) => {
    exec('bin/plyql --version', (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain('plyql version 0.');
      expect(stderr).to.equal('');
      testComplete();
    });
  });

});
