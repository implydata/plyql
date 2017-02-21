import { Dataset } from "plywood";
import * as fs from 'fs';
import * as path from 'path';

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

