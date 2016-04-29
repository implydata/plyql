const { expect } = require('chai');
const { sane } = require('./utils.js');
const exec = require('child_process').exec;

describe('basics', () => {
  it('shows help', (testComplete) => {
    exec('bin/plyql', (error, stdout, stderr) => {
      expect(error).to.equal(null);
      expect(stdout).to.contain(sane`
        Usage: plyql [options]
      
        Examples:
          plyql -h 10.20.30.40 -q 'SHOW TABLES'
        
          plyql -h 10.20.30.40 -q 'DESCRIBE twitterstream'
        
          plyql -h 10.20.30.40 -q 'SELECT MAX(__time) AS maxTime FROM twitterstream'
        
          plyql -h 10.20.30.40 -d twitterstream -i P5D -q \\
            'SELECT SUM(tweet_length) as TotalTweetLength WHERE first_hashtag = "#imply"'
        
        Arguments:
        
               --help         print this help message
               --version      display the version number
          -v,  --verbose      display the queries that are being made
          -h,  --host         the host to connect to
          -d,  --data-source  use this data source for the query (supersedes FROM clause)
          -i,  --interval     add (AND) a __time filter between NOW-INTERVAL and NOW
          -tz, --timezone     the default timezone  
          -o,  --output       the output format. Possible values: table (default), json, csv, tsv, flat
          -t,  --timeout      the time before a query is timed out in ms (default: 180000)
          -r,  --retry        the number of tries a query should be attempted on error, 0 = unlimited, (default: 2)
          -c,  --concurrent   the limit of concurrent queries that could be made simultaneously, 0 = unlimited, (default: 2)
               --rollup       use rollup mode [COUNT() -> SUM(count)]
               
          -q,  --query        the query to run
               --experimental-mysql-facade  [Experimental] the port on which to start the MySQL facade server
        
               --druid-version            Assume this is the Druid version and do not query it
               --skip-cache               disable Druid caching
               --introspection-strategy   Druid introspection strategy
                   Possible values:
                   * segment-metadata-fallback - (default) use the segmentMetadata and fallback to GET route
                   * segment-metadata-only     - only use the segmentMetadata query
                   * datasource-get            - only use GET /druid/v2/datasources/DATASOURCE route
        
          -fu, --force-unique     force a column to be interpreted as a hyperLogLog uniques
          -fh, --force-histogram  force a column to be interpreted as an approximate histogram
        
          -a,  --allow        enable a behaviour that is turned off by default
                   eternity     allow queries not filtered on time
                   select       allow 'select' queries
      `);
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
