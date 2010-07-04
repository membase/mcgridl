/* Copyright 2010 NorthScale, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var sys = require('sys'),
    net = require('net'),
    url = require('url'),
   http = require('http'),
   path = require('path'),
     fs = require('fs');

exports.respond = function(response, code, msg, contentType, encoding) {
  response.sendHeader(code, {"Content-Type": contentType || "text/plain"});
  response.write(msg, encoding || "ascii");
  response.end();
};

exports.notFound = function(response) {
  exports.respond(response, 404, "404 Not Found\n");
};

exports.serveStatic = function(uri, response, contentType, prefix) {
  if (uri.indexOf('..') >= 0) {
    return exports.notFound(response);
  }

  if (contentType == null &&
      uri.slice(-5) == ".html") {
    contentType = 'text/html';
  }
  if (contentType == null &&
      uri.slice(-4) == ".css") {
    contentType = 'text/css';
  }

  var r = path.join(process.cwd(), prefix || '');
  var p = path.join(r, uri);

  path.exists(p, function(exists) {
      if (!exists) {
        return exports.notFound(response);
      }

      fs.readFile(p, "binary", function(err, content) {
          if (err) {
            exports.respond(response, 500, err + "\n");
          } else {
            exports.respond(response, 200, content, contentType, "binary");
          }
		});
	});
}

