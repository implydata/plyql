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

let segmentMetadata = require("./wiki-segment-metadata").segmentMetadata;
let groupBy = require("./wiki-group-by").channel;
let select = require("./wiki-select").empty;
let timeseries = require("./wiki-timeseries").timeseries;

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
