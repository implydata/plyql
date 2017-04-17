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

import { Dataset, PlyType, External } from "plywood";
import { getData } from "./datasets";

const DB_NAME = 'plyql1';

interface SchemataRow {
  "CATALOG_NAME": string;
  "SCHEMA_NAME": string;
  "DEFAULT_CHARACTER_SET_NAME": string;
  "DEFAULT_COLLATION_NAME": string;
  "SQL_PATH": string;
}
let schemataData: SchemataRow[] = [
  {
    "CATALOG_NAME": "def",
    "SCHEMA_NAME": "information_schema",
    "DEFAULT_CHARACTER_SET_NAME": "utf8",
    "DEFAULT_COLLATION_NAME": "utf8_general_ci",
    "SQL_PATH": null
  },
  {
    "CATALOG_NAME": "def",
    "SCHEMA_NAME": DB_NAME,
    "DEFAULT_CHARACTER_SET_NAME": "utf8",
    "DEFAULT_COLLATION_NAME": "utf8_general_ci",
    "SQL_PATH": null
  }
];

interface TablesRow {
  TABLE_CATALOG: string;
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  TABLE_TYPE: string;
  ENGINE: string;
  VERSION: number;
  ROW_FORMAT: string;
  TABLE_ROWS: number;
  AVG_ROW_LENGTH: number;
  DATA_LENGTH: number;
  MAX_DATA_LENGTH: number;
  INDEX_LENGTH: number;
  DATA_FREE: number;
  AUTO_INCREMENT: number;
  CREATE_TIME: Date;
  UPDATE_TIME: Date;
  CHECK_TIME: Date;
  TABLE_COLLATION: string;
  CHECKSUM: number;
  CREATE_OPTIONS: string;
  TABLE_COMMENT: string;
}

let tablesData: TablesRow[] = [
  {
    "TABLE_CATALOG": "def",
    "TABLE_SCHEMA": "information_schema",
    "TABLE_NAME": "COLUMNS",
    "TABLE_TYPE": "SYSTEM VIEW",
    "ENGINE": "InnoDB",
    "VERSION": 10,
    "ROW_FORMAT": "Dynamic",
    "TABLE_ROWS": null,
    "AVG_ROW_LENGTH": 0,
    "DATA_LENGTH": 16384,
    "MAX_DATA_LENGTH": 0,
    "INDEX_LENGTH": 0,
    "DATA_FREE": 141557760,
    "AUTO_INCREMENT": null,
    "CREATE_TIME": null,
    "UPDATE_TIME": null,
    "CHECK_TIME": null,
    "TABLE_COLLATION": "utf8_general_ci",
    "CHECKSUM": null,
    "CREATE_OPTIONS": "max_rows=2789",
    "TABLE_COMMENT": ''
  },
  {
    "TABLE_CATALOG": "def",
    "TABLE_SCHEMA": "information_schema",
    "TABLE_NAME": "SCHEMATA",
    "TABLE_TYPE": "SYSTEM VIEW",
    "ENGINE": "MEMORY",
    "VERSION": 10,
    "ROW_FORMAT": "Fixed",
    "TABLE_ROWS": null,
    "AVG_ROW_LENGTH": 3464,
    "DATA_LENGTH": 0,
    "MAX_DATA_LENGTH": 16738048,
    "INDEX_LENGTH": 0,
    "DATA_FREE": 0,
    "AUTO_INCREMENT": null,
    "CREATE_TIME": null,
    "UPDATE_TIME": null,
    "CHECK_TIME": null,
    "TABLE_COLLATION": "utf8_general_ci",
    "CHECKSUM": null,
    "CREATE_OPTIONS": "max_rows=4843",
    "TABLE_COMMENT": ''
  },
  {
    "TABLE_CATALOG": "def",
    "TABLE_SCHEMA": "information_schema",
    "TABLE_NAME": "TABLES",
    "TABLE_TYPE": "SYSTEM VIEW",
    "ENGINE": "MEMORY",
    "VERSION": 10,
    "ROW_FORMAT": "Fixed",
    "TABLE_ROWS": null,
    "AVG_ROW_LENGTH": 9441,
    "DATA_LENGTH": 0,
    "MAX_DATA_LENGTH": 16757775,
    "INDEX_LENGTH": 0,
    "DATA_FREE": 0,
    "AUTO_INCREMENT": null,
    "CREATE_TIME": null,
    "UPDATE_TIME": null,
    "CHECK_TIME": null,
    "TABLE_COLLATION": "utf8_general_ci",
    "CHECKSUM": null,
    "CREATE_OPTIONS": "max_rows=1777",
    "TABLE_COMMENT": ''
  }
];

function addExternalToTables(source: string): void {
  tablesData.push({
    "TABLE_CATALOG": "def",
    "TABLE_SCHEMA": DB_NAME,
    "TABLE_NAME": source,
    "TABLE_TYPE": "BASE TABLE",
    "ENGINE": "InnoDB",
    "VERSION": 10,
    "ROW_FORMAT": "Dynamic",
    "TABLE_ROWS": 1e7,
    "AVG_ROW_LENGTH": 1337,
    "DATA_LENGTH": 90832896,
    "MAX_DATA_LENGTH": 0,
    "INDEX_LENGTH": 0,
    "DATA_FREE": 6291456,
    "AUTO_INCREMENT": null,
    "CREATE_TIME": null,
    "UPDATE_TIME": null,
    "CHECK_TIME": null,
    "TABLE_COLLATION": "utf8_general_ci",
    "CHECKSUM": null,
    "CREATE_OPTIONS": '',
    "TABLE_COMMENT": ''
  });
}


interface ColumnsRow {
  TABLE_CATALOG: string;
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  ORDINAL_POSITION: number,
  COLUMN_DEFAULT: string,
  IS_NULLABLE: string;
  DATA_TYPE: string;
  CHARACTER_MAXIMUM_LENGTH: number;
  CHARACTER_OCTET_LENGTH: number;
  NUMERIC_PRECISION: number,
  NUMERIC_SCALE: number,
  DATETIME_PRECISION: number,
  CHARACTER_SET_NAME: string;
  COLLATION_NAME: string;
  COLUMN_TYPE: string;
  COLUMN_KEY: string;
  EXTRA: string;
  PRIVILEGES: string;
  COLUMN_COMMENT: string;
  GENERATION_EXPRESSION: string;
}

let columnsData: ColumnsRow[] = getData('columns');

function getDataType(type: PlyType): string {
  switch (type) {
    case 'BOOLEAN': return 'tinyint';
    case 'STRING': return 'varchar';
    case 'SET/STRING': return 'varchar';
    case 'NUMBER': return 'double';
    case 'TIME': return 'timestamp';
    default: return 'varchar';
  }
}

function getColumnType(type: PlyType): string {
  switch (type) {
    case 'BOOLEAN': return 'tinyint(1)';
    case 'STRING': return 'varchar(255)';
    case 'SET/STRING': return 'varchar(255)';
    case 'NUMBER': return 'double';
    case 'TIME': return 'timestamp';
    default: return 'varchar(255)';
  }
}

function addExternalToColumns(source: string, external: External, mysqlTypes: boolean): void {
  let { attributes } = external;
  for (let i = 0; i < attributes.length; i++) {
    let attribute = attributes[i];
    columnsData.push({
      "TABLE_CATALOG": "def",
      "TABLE_SCHEMA": DB_NAME,
      "TABLE_NAME": source,
      "COLUMN_NAME": attribute.name,
      "ORDINAL_POSITION": i + 1,
      "COLUMN_DEFAULT": null,
      "IS_NULLABLE": "YES",
      "DATA_TYPE": mysqlTypes ? getDataType(attribute.type) : attribute.type,
      "CHARACTER_MAXIMUM_LENGTH": 255,
      "CHARACTER_OCTET_LENGTH": 1020,
      "NUMERIC_PRECISION": null,
      "NUMERIC_SCALE": null,
      "DATETIME_PRECISION": null,
      "CHARACTER_SET_NAME": "utf8mb4",
      "COLLATION_NAME": "utf8mb4_bin",
      "COLUMN_TYPE": mysqlTypes ? getColumnType(attribute.type) : attribute.type,
      "COLUMN_KEY": '',
      "EXTRA": '',
      "PRIVILEGES": "select",
      "COLUMN_COMMENT": attribute.nativeType || '',
      "GENERATION_EXPRESSION": ''
    });
  }
}

export function addExternal(source: string, external: External, mysqlTypes: boolean): void {
  addExternalToTables(source);
  addExternalToColumns(source, external, mysqlTypes);
}

export function getSchemataDataset() {
  return Dataset.fromJS(schemataData);
}

export function getTablesDataset() {
  return Dataset.fromJS(tablesData);
}

export function getColumnsDataset() {
  return Dataset.fromJS(columnsData);
}

