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

import * as http from 'http';
import * as express from 'express';
import { Request, Response } from 'express';
import * as bodyParser from 'body-parser';
import * as compress from 'compression';

export interface JSONParameters {
  sql?: string;
  expression?: any;
}

export interface JSONQueryProcessor {
  (parameters: JSONParameters, res: any): void;
}

export function createJSONServer(port: number, queryProcessor: JSONQueryProcessor): void {
  let app = express();
  app.disable('x-powered-by');

  app.use(compress());

  app.get('/health', (req: Request, res: Response) => {
    res.send(`I am healthy @ ${new Date().toISOString()}`);
  });

  app.use(bodyParser.json());

  // Regular PlyQL route
  app.post('/plyql', (req: Request, res: Response) => {
    let { sql } = req.body;

    if (typeof sql !== "string") {
      res.status(400).json({ error: "'sql' must be a string" });
      return;
    }

    console.log(`Got SQL: ${sql}`);
    queryProcessor({ sql }, res);
  });

  // Extra Plywood route
  app.post('/plywood', (req: Request, res: Response) => {
    let { expression } = req.body;

    if (typeof expression === "undefined") {
      res.status(400).json({ error: "'expression' must be defined" });
      return;
    }

    console.log(`Got expression`);
    queryProcessor({ expression }, res);
  });

  app.use((err: any, req: Request, res: Response, next: Function) => {
    res.status(err.status || 500);
    res.json({ error: err.message });
  });

  let server = http.createServer(app);

  server.on('error', (error: any) => {
    if (error.syscall !== 'listen') {
      throw error;
    }

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        console.error(`Port ${port} requires elevated privileges`);
        process.exit(1);
        break;

      case 'EADDRINUSE':
        console.error(`Port ${port} is already in use`);
        process.exit(1);
        break;

      default:
        throw error;
    }
  });

  server.on('listening', () => {
    let address = server.address();
    console.log('PlyQL server listening on port: ' + address.port);
  });

  app.set('port', port);
  server.listen(port);
}

