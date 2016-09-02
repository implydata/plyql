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
 * limitations under the License.
 */

// To be used as a tag
exports.sane = function() {
  var str = String.raw.apply(String, arguments);

  var match = str.match(/^\n( *)/m);
  if (!match) throw new Error('sane string must start with a \\n is:' + str);
  var spaces = match[1].length;

  var lines = str.split('\n');
  lines.shift(); // Remove the first empty lines
  lines = lines.map((line) => line.substr(spaces)); // Remove indentation
  if (lines[lines.length - 1] === '') lines.pop(); // Remove last line if empty

  return lines.join('\n')
    .replace(/\\`/g, '`')    // Fix \` that should be `
    .replace(/\\\{/g, '{')   // Fix \{ that should be {
    .replace(/\\\\/g, '\\'); // Fix \\ that should be \
};
