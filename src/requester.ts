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

import { PlywoodRequester } from 'plywood-base-api';
import { $, retryRequesterFactory, verboseRequesterFactory, concurrentLimitRequesterFactory } from 'plywood';
import { druidRequesterFactory, DruidRequestDecorator } from 'plywood-druid-requester';
//import { mySqlRequesterFactory } from 'plywood-mysql-requester';

export interface ProperDruidRequesterOptions {
  druidHost?: string;
  retry?: number;
  timeout?: number;
  verbose?: boolean;
  concurrentLimit?: number;
  requestDecorator?: DruidRequestDecorator;
  socksHost?: string;
  socksUsername?: string;
  socksPassword?: string;
}

export function properDruidRequesterFactory(options: ProperDruidRequesterOptions): PlywoodRequester<any> {
  let {
    druidHost,
    retry,
    timeout,
    verbose,
    concurrentLimit,
    requestDecorator,
    socksHost,
    socksUsername,
    socksPassword
  } = options;

  let druidRequester = druidRequesterFactory({
    host: druidHost,
    timeout: timeout || 30000,
    requestDecorator,
    socksHost,
    socksUsername,
    socksPassword
  });

  if (retry) {
    druidRequester = retryRequesterFactory({
      requester: druidRequester,
      retry: retry,
      delay: 500,
      retryOnTimeout: false
    });
  }

  if (verbose) {
    druidRequester = verboseRequesterFactory({
      requester: druidRequester
    });
  }

  if (concurrentLimit) {
    druidRequester = concurrentLimitRequesterFactory({
      requester: druidRequester,
      concurrentLimit: concurrentLimit
    });
  }

  return druidRequester;
}
