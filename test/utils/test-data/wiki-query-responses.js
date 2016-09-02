var segmentMetadata = require("./wiki-segment-metadata").segmentMetadata;
var groupBy = require("./wiki-group-by").channel;
var select = require("./wiki-select").channel;
var timeseries = require("./wiki-timeseries").timeseries;

exports.result = {
  "segmentMetadata": { json: segmentMetadata },
  "timeseries": {json: timeseries},
  "groupBy": { json: groupBy },
  "timeBoundary": {
    json: [
    {
      "timestamp": "2015-09-12T23:59:00.000Z",
      "result": {
        "maxTime": "2015-09-12T23:59:00.000Z"
        }
      }
    ]
  },
  "topN": {
    json: [
      {
        "timestamp": "2015-09-12T00:46:00.000Z",
        "result": [
          {
            "channel": "ar",
            "!DUMMY": 4476
          },
          {
            "channel": "be",
            "!DUMMY": 269
          },
          {
            "channel": "bg",
            "!DUMMY": 778
          }
        ]
      }
    ]
  },
  "select" : { json: select }
};