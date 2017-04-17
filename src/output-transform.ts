/*
 * Copyright 2015-2017 Imply Data, Inc.
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

import { Transform } from 'readable-stream';
import { Timezone, isDate } from 'chronoshift';
import { PlywoodValueBuilder, TimeRange, Set, Dataset, PlywoodValue } from 'plywood';
import { table, getBorderCharacters, createStream } from 'table';

function streamFlatten(v: any): any {
  return v;
}

function escapeControlChars(str: string): string {
  return str.replace(/[\x01-\x1A]/g, (x) => '\\x' + ('0' + x.charCodeAt(0).toString(16)).substr(-2))
}

function formatValue(v: any, tz: Timezone): any {
  if (v == null) return 'NULL';
  if (isDate(v)) return Timezone.formatDateWithTimezone(v, tz);
  if (Set.isSet(v) || TimeRange.isTimeRange(v)) return v.toString(tz);
  return escapeControlChars('' + v);
}

export function getOutputTransform(output: string, timezone: Timezone): Transform {
  switch (output) {
    case 'table':
      return collectOutput((dataset: Dataset) => {
        let flatDataset = dataset.flatten({ order: 'preorder' });
        let columnNames = flatDataset.attributes.map(c => c.name);

        if (columnNames.length) {
          let tableData = [columnNames].concat(flatDataset.data.map((flatDatum) => {
            return columnNames.map(cn => formatValue(flatDatum[cn], timezone))
          }));

          return table(tableData, {
            border: getBorderCharacters('norc'),
            drawHorizontalLine: (index: number, size: number) => index <= 1 || index === size
          });
        } else {
          return '';
        }
      });

    case 'csv':
      return collectOutput((v: PlywoodValue) => {
        if (v instanceof Dataset) {
          return v.toCSV({ finalLineBreak: 'include', timezone });
        } else {
          return String(v);
        }
      });

    case 'tsv':
      return collectOutput((v: PlywoodValue) => {
        if (v instanceof Dataset) {
          return v.toTSV({ finalLineBreak: 'include', timezone });
        } else {
          return String(v);
        }
      });

    case 'json':
    case 'flat':
      return collectOutput((v: PlywoodValue) => {
        if (v instanceof Dataset) {
          return v.flatten().data.map((d) => JSON.stringify(d)).join('\n') + '\n';
        } else {
          return String(v);
        }
      });

    case 'plywood':
      return collectOutput((v: PlywoodValue) => {
        return JSON.stringify(v, null, 2);
      });

    case 'plywood-stream':
      return jsonOutput();

    default:
      throw new Error('Unknown output type');
  }
}

function jsonOutput(): Transform {
  return new Transform({
    objectMode: true,
    transform: function(chunk, encoding, callback) {
      callback(null, JSON.stringify(chunk) + '\n');
    }
  });
}

// function tableOutput(): Transform {
//   let table: any;
//   return new Transform({
//     objectMode: true,
//     transform: function(chunk, encoding, callback) {
//       if (chunk.type === 'init' && !table) {
//         table = createStream({
//           columnDefault: {
//             width: 50
//           },
//           columnCount: chunk.attributes.length
//         });
//       }
//       callback(null, JSON.stringify(chunk) + '\n');
//     }
//   });
// }

function collectOutput(onDone: (value: any) => string): Transform {
  let pvb = new PlywoodValueBuilder();
  return new Transform({
    objectMode: true,
    transform: function(chunk, encoding, callback) {
      pvb.processBit(chunk);
      callback(null);
    },
    flush: function(callback) {
      callback(null, onDone(pvb.getValue()));
    }
  });
}
