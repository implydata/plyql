/// <reference path="../typings/express/express.d.ts" />
/// <reference path="../typings/body-parser/body-parser.d.ts" />
/// <reference path="../typings/compression/compression.d.ts" />

import * as Q from 'q';
import { Timezone } from "chronoshift";
import * as http from 'http';
import * as express from 'express';
import { Request, Response } from 'express';
import * as bodyParser from 'body-parser';
import * as compress from 'compression';

export interface JSONParameters {
  sql: string;
}

export interface JSONQueryProcessor {
  (parameters: JSONParameters, res: any): void;
}

export function createJSONServer(port: number, queryProcessor: JSONQueryProcessor): void {
  var app = express();
  app.disable('x-powered-by');

  app.use(compress());

  app.get('/health', (req: Request, res: Response) => {
    res.send(`I am healthy @ ${new Date().toISOString()}`);
  });

  app.use(bodyParser.json());
  app.post('/plyql', (req: Request, res: Response) => {
    var { sql } = req.body;

    if (typeof sql !== "string") {
      res.status(400).send({ error: "'sql' must be a string" });
      return;
    }

    console.log(`Got SQL: ${sql}`);
    queryProcessor({ sql }, res);
  });

  var server = http.createServer(app);

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
    var address = server.address();
    console.log('PlyQL server listening on port: ' + address.port);
  });

  app.set('port', port);
  server.listen(port);
}

