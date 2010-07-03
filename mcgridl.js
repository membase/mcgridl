#!/usr/bin/env node

var sys = require('sys'),
    net = require('net'),
    url = require('url'),
   repl = require('repl'),
   http = require('http'),
   path = require('path'),
 Buffer = require('buffer').Buffer;

var mcgridl_util = require('./mcgridl_util');

jjj = JSON.stringify;

// ----------------------------------------------------

var port = 9000;
var servers = [];
var concurrency = 1;

for (var i = 2; i < process.argv.length; i++) {
  var arg = process.argv[i];
  if (arg == '-p') {
    port = process.argv[++i];
  }
  if (arg == '-s') {
    var hp = process.argv[++i].split(':');
    servers.push({ host: hp[0], port: hp[1] || 11211, out: false });
  }
  if (arg == '-c') {
    concurrency = process.argv[++i];
  }
}

if (servers.length <= 0) {
  sys.puts("mcgridl - a load-generator for memcached/membase\n");
  sys.puts("  usage: " + process.argv[0] + " mcgridl.js" +
              " [-p 9000]" +
              " [-c 1]" +
              " -s mchost[:11211]" +
              " [-s mchost2[:11211]] ...\n");
  sys.puts("    -p is the port where mcgridl will serve its web UI.");
  sys.puts("    -c is the # of concurrent clients against each memcached server.");
  sys.puts("    -s specifies another memcached host:port target to hit.");
  process.exit(-1);
}

var targets = [];

for (var i = 0; i < concurrency; i++) {
  for (var j = 0; j < servers.length; j++) {
    targets.push(servers[j]);
  }
}

// ----------------------------------------------------

var targetHandles = [];
var statsHandle;

if (targets.length > 0) {
  for (var i = 0; i < targets.length; i++) {
    targetHandles[i] = mcgridl_util.startAsciiDataClient(targets[i].host, targets[i].port, i, targets[i]);
  }

  statsHandle = mcgridl_util.startAsciiStatsClient(targets[0].host, targets[0].port, { out: true });
}
