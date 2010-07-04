#!/usr/bin/env node

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
   repl = require('repl'),
   http = require('http'),
   path = require('path'),
 Buffer = require('buffer').Buffer;

var mcgridl_util = require('./mcgridl_util'),
            util = require('./util');

// ----------------------------------------------------

var port = 8888;
var servers = [];
var concurrency = 1;
var verbose = 0;

for (var i = 2; i < process.argv.length; i++) {
  var arg = process.argv[i];
  if (arg == '-p') {
    port = process.argv[++i];
  }
  if (arg == '-s') {
    var hp = process.argv[++i].split(':');
    servers.push({ host: hp[0], port: hp[1] || 11211 });
  }
  if (arg == '-c') {
    concurrency = process.argv[++i];
  }
  if (arg == '-v') {
    verbose++;
  }
  if (arg == '-h' || arg == '-?' || arg == '--help') {
    usage();
  }
}

function usage() {
  sys.puts("mcgridl - a load-generator for memcached/membase\n");
  sys.puts("  usage: " + process.argv[0] + " mcgridl.js" +
           " [-p " + port + "]" +
           " [-c 1]" +
           " [-v [-v [-v]]]" +
           " -s mchost[:11211]" +
           " [-s mchost2[:11211]] ...\n");
  sys.puts("    -p is the port where mcgridl will serve its web UI.");
  sys.puts("    -c is the # of concurrent clients against each memcached server.");
  sys.puts("    -s specifies another memcached host:port target to hit.");
  sys.puts("    -v specifies more verbosity.\n");
  process.exit(-1);
}

if (servers.length <= 0) {
  sys.puts("mcgridl needs at least one server: " +
           process.argv[0] + " mcgridl.js " + "-s <host>");
  process.exit(-1);
}

// ----------------------------------------------------

var dataClients = [];
var statsClient;

function clearClients() {
  // Stop & clear any existing clients.
  //
  for (var i = 0; i < dataClients.length; i++) {
    if (dataClients[i]) {
      dataClients[i].stop();
    }
  }
  dataClients = [];

  if (statsClient) {
    statsClient.stop();
  }
  statsClient = null;
}

function makeClients(servers) {
  // Expand parameters for the new servers.
  //
  var params = [];

  for (var i = 0; i < concurrency; i++) {
    for (var j = 0; j < servers.length; j++) {
      servers.dbg = (verbose > 2);
      params.push(servers[j]);
    }
  }

  // Clear old clients and create new ones, if needed.
  //
  clearClients();

  if (params.length > 0) {
    for (var i = 0; i < params.length; i++) {
      dataClients[i] = mcgridl_util.startAsciiDataClient(params[i].host, params[i].port, i, params[i]);
    }

    statsClient = mcgridl_util.startAsciiStatsClient(params[0].host, params[0].port,
                                                     { onStatsResult: onStatsResult,
                                                       dbg: (verbose > 1) });
  }
}

// ----------------------------------------------------

makeClients(servers);

// ----------------------------------------------------

http.createServer(function(request, response) {
    var u = url.parse(request.url);

    if (request.method == 'GET') {
      if (u.pathname.indexOf('/static/') == 0) {
        util.serveStatic(u.pathname, response);
        return;
      }

      if (u.pathname == '/stats.json') {
        serveStats(response);
        return;
      }

      if (u.pathname == '/stats.txt') {
        serveStats(response, 'text/plain');
        return;
      }

      util.serveStatic('/static/index.html', response, "text/html");
      return;
    }

    if (request.method == 'POST') {
      if (u.pathname.indexOf('/statsPause') == 0) {
        return;
      }
    }

    return util.notFound(request, response);
}).listen(port);

// ----------------------------------------------------

var statsMaxSamples = 200;
var stats = [];

// Not treated as milliseconds, but instead as a 'unique'
// increasing number, even after occasional server restarts.
//
var stime = (new Date()).getTime() - 1278200000000;

function onStatsResult(h, result) {
  // Save the stats result that we get from memcached, but only keep a
  // limited number.  Clients can use the stime to handle duplicates.
  //
  while (stats.length > statsMaxSamples) {
    stats.shift();
  }

  stats.push([stime, result]);
  stime++;

  if (verbose > 0) {
    sys.log("onStatsResult: " + stime + " " + stats.length);
  }
}

function serveStats(response, contentType) {
  var body = JSON.stringify({
    servers: servers,
    stats: stats
  });

  response.writeHead(200, {'Content-Type': contentType || 'text/json'});
  response.write(body);
  response.end();

  if (verbose > 0) {
    sys.log("serveStats: " + stime);
  }
}

sys.log('your mcgridl is ready at http://*:' + port + '/index.html');

