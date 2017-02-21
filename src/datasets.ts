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

import * as fs from 'fs';
import * as path from 'path';
import { Dataset } from "plywood";

export const getData = (name: string) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, `../assets/mysql-static-data/${name}.json`), 'utf-8'));
  } catch(e) {
    throw new Error(`Could not read data for ${name}: ${e.message}`);
  }
};

export const getDataset = (name: string) => Dataset.fromJS(getData(name));

export const getCharacterSetsDataset = () => getDataset('character-sets');
export const getCollationsDataset = () => getDataset('collations');
export const getKeyColumnUsageDataset = () => getDataset('key-column-usage');
export const getIndexDataset = () => getDataset('index');
export const getWarningsDataset = () => getDataset('warnings');

