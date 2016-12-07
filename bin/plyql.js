"use strict";

var path = require('path');
var fs   = require('fs');
var lib  = path.join(path.dirname(fs.realpathSync(__filename)), '../build');

var plyql = require(lib + '/cli');

plyql.run(plyql.parseArguments())
  .catch(function(e) {
    console.error(e.message);
    process.exit(1);
  })
  .done();
