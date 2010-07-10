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
var vbucket = false;
var verbose = 0;

for (var i = 2; i < process.argv.length; i++) {
  var arg = process.argv[i];
  if (arg == '-p') {
    port = process.argv[++i];
  }
  if (arg == '-s') {
    var hp = process.argv[++i].split(':');
    servers.push({ host: hp[0],
                   port: hp[1] || 11211,
                   port_proxy: hp[1] || 11211,
                   port_direct: hp[2] || ((hp[1] || 11211) - 1) });
  }
  if (arg == '-c') {
    concurrency = process.argv[++i];
  }
  if (arg == '-V') {
    vbucket = true;
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
           " [-V]" +
           " [-v [-v [-v]]]\n" +
           "                        " +
           " -s mchost[:11211[:11210]]" +
           " [-s mchost2[:11211[:11210]]] ...\n");
  sys.puts("    -p is the port where mcgridl will serve its web UI.");
  sys.puts("    -c is the # of concurrent clients against each memcached server.");
  sys.puts("    -s specifies another memcached host:port target to hit,");
  sys.puts("       using the format hostname[:proxy_port[:direct_port]]");
  sys.puts("    -V specifies that the server (like membase) knows vbuckets.");
  sys.puts("    -v specifies more verbosity.\n");
  process.exit(-1);
}

if (servers.length <= 0) {
  sys.puts("mcgridl needs at least one server: " +
           process.argv[0] + " mcgridl.js " + "-s <host>");
  process.exit(-1);
}

// ----------------------------------------------------

var clients = null;

function clearClients() {
  // Stop & clear any existing clients.
  //
  if (clients) {
    for (var i = 0; clients.item && i < clients.item.length; i++) {
      if (clients.item[i]) {
        clients.item[i].stop();
      }
    }

    if (clients.stats) {
      clients.stats.stop();
    }

    for (var i = 0; clients.stats_vbucket && i < clients.stats_vbucket.length; i++) {
      if (clients.stats_vbucket[i]) {
        clients.stats_vbucket[i].stop();
      }
    }
  }

  clients = {
    item: [],
    stats: null,
    stats_vbucket: []
  }
}

function makeClients(servers, concurrency) {
  // Clear old clients.
  //
  clearClients();

  // Expand parameters for the new clients.
  //
  var params = [];

  for (var i = 0; i < concurrency; i++) {
    for (var j = 0; j < servers.length; j++) {
      servers.dbg = (verbose > 2);
      params.push(servers[j]);
    }
  }

  // Create new clients, if needed.
  //
  if (params.length > 0) {
    for (var i = 0; i < params.length; i++) {
      clients.item[i] = mcgridl_util.startAsciiItemClient(params[i].host,
                                                          params[i].port,
                                                          i, params[i]);
    }

    clients.stats = mcgridl_util.startAsciiStatsClient(params[0].host,
                                                       params[0].port,
                                                       { onStatsResult: onStatsResult,
                                                         dbg: (verbose > 1) });

    if (vbucket) {
      for (var i = 0; i < servers.length; i++) {
        clients.stats_vbucket[i] =
          mcgridl_util.startBinaryStatsClient(servers[i].host,
                                              servers[i].port_direct,
                                              { onClose: remakeClients,
                                                statsSubCommand: "vbucket",
                                                onStatsResult: onStatsVBucketResult,
                                                dbg: (verbose > 1) });
      }
    }
  }
}

// ----------------------------------------------------

var remakeClientsId = null;
var remakeClientsCount = 0;

function remakeClients() {
  sys.log('remaking clients: ' + remakeClientsId + ' ' + remakeClientsCount);

  if (!remakeClientsId) {
    remakeClientsCount++;
    remakeClientsId = setTimeout(function() {
      makeClients(servers, concurrencey);
      remakeClientsId = null;
      }, Math.max(5000, 1000 + (500 * remakeClientsCount)));
  }
}

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
var stats           = [];
var stats_vbucket   = {}; // Key is 'host:11211:11210',
                          // value is array of stats vbucket results.

// Not treated as milliseconds, but instead as a 'unique'
// increasing number, even after occasional server restarts.
//
var stime = (new Date()).getTime() - 1278200000000;

function onStatsResult(h, result) {
  saveStatsResult('stats', h, result, stats);
}

function onStatsVBucketResult(h, result) {
  var i = h.stats();
  var key = i.host + ":" + i.port;
  var arr = stats_vbucket[key];
  if (!arr) {
    arr = stats_vbucket[key] = [];
  }
  saveStatsResult('vbuck', h, result, arr);
}

function saveStatsResult(logMsg, h, result, arr) {
  // Save the stats result that we received, but only keep a limited
  // number.  Clients can use the stime to handle duplicates.
  //
  while (arr.length > statsMaxSamples) {
    arr.shift();
  }

  arr.push([stime, result]);
  stime++;

  if (verbose > 0) {
    sys.log("stats-result: " + logMsg + " " + stime + " " + arr.length);
  }
}

function serveStats(response, contentType) {
  var body = JSON.stringify({
    servers: servers,
    stats: stats,
    stats_vbucket: stats_vbucket
  });

  response.writeHead(200, {'Content-Type': contentType || 'text/json'});
  response.write(body);
  response.end();

  if (verbose > 0) {
    sys.log("serveStats: " + stime);
  }
}

// ----------------------------------------------------

makeClients(servers, concurrency);

sys.log('your mcgridl is ready at http://*:' + port + '/index.html');

