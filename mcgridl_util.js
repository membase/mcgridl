#!/usr/bin/env node

var sys = require('sys'),
    net = require('net'),
    url = require('url'),
   repl = require('repl'),
   http = require('http'),
   path = require('path'),
 Buffer = require('buffer').Buffer;

// ----------------------------------------------------

exports.startAsciiDataClient = function(host, port, id, opts) {
  opts = opts || {};
  opts.maxInflight = opts.maxInFlight || 1;
  opts.maxGoodKey  = opts.maxGoodKey || 1000;
  opts.setRatio    = opts.setRatio || 0.10;
  opts.hitRatio    = opts.hitRatio || 0.90;

  var outPrefix = id + ': ';
  var outJoin   = '\r\n' + outPrefix;
  function out(str) {
    if (opts.out) {
      sys.puts(outPrefix + str.split('\r\n').join(outJoin));
    }
  }

  var stream = net.createConnection(port, host);
  if (stream == null) {
    return false;
  }

  var paused = false;
  var inflight = 0;
  var nextGoodKey = 0;

  stream.setEncoding('binary');

  stream.addListener('connect', writeMore);
  stream.addListener('drain', writeMore);
  stream.addListener('error',
    function(ex) {
      out('EX: ' + ex);
    });
  stream.addListener('data',
    function(data) {
      out(data);
      inflight--;
      if (inflight < opts.maxInflight) {
        writeMore();
      }
    });

  var totSet = 0;
  var totGetHit = 0;
  var totGetMiss = 0;

  function setItem() {
    var i = nextGoodKey;
    if (i >= opts.maxGoodKey) {
      i = Math.floor(Math.random() * opts.maxGoodKey);
    } else {
      nextGoodKey++;
    }

    var command = 'set good_' + i + ' 0 0 1\r\n1\r\n';
    stream.write(command, 'binary');
    out(command);

    totSet++;
  }

  function getItem(wantHit) {
    var i = Math.floor(Math.random() * nextGoodKey);
    var prefix;

    if (wantHit) {
      totGetHit++;
      prefix = 'hit_'
    } else {
      totGetMiss++;
      prefix = 'miss_';
    }

    var command = 'get ' + prefix + i + '\r\n';
    stream.write(command, 'binary');
    out(command);
  }

  function writeMore() {
    if (paused) {
      return;
    }

    if (inflight > opts.maxInflight) {
      return;
    }

    if (Math.random() < opts.setRatio) {
      setItem();
    } else {
      if (Math.random() < opts.hitRatio) {
        getItem(true);
      } else {
        getItem(false);
      }
    }

    inflight++;
  }

  return {
    play: function() {
      paused = false;
      writeMore();
    },
    pause: function() {
      paused = true;
    },
    stats: function() {
      return {
        host: host,
        port: port,
        id: id,
        opts: opts,
        paused: paused,
        inflight: inflight,
        totSet: totSet,
        totGetHit: totGetHit,
        totGetMiss: totGetMiss
      }
    }
  }
}

// ----------------------------------------------------

exports.startAsciiStatsClient = function(host, port, opts) {
  opts = opts || {};
  opts.statsIntervalMillis = opts.statsIntervalMillis || 500;

  var statsSuffix = opts.statsSubCommand ? (' ' + opts.statsSubCommand) : '';

  var outPrefix = host + ":" + port + ' STATS: ';
  var outJoin   = '\r\n' + outPrefix;
  function out(str) {
    if (opts.out) {
      sys.puts(outPrefix + str.split('\r\n').join(outJoin));
    }
  }

  var stream = net.createConnection(port, host);
  if (stream == null) {
    return false;
  }

  stream.setEncoding('binary');

  var paused = false;
  var inflight = 0;
  var totRequests = 0;

  stream.addListener('data',
    function(data) {
      var a = data.split('\r\n');
      for (var i = 0; i < a.length; i++) {
        if (a[i] == 'END') {
          inflight--;
        } else {
          out(a[i]);
        }
      }
    });

  var intervalId = setInterval(requestStats, opts.statsIntervalMillis);

  function requestStats() {
    if (paused) {
      return;
    }

    if (inflight <= 0) {
      var command = 'stats' + statsSuffix + '\r\n';
      stream.write(command, 'binary');
      out(command);
      totRequests++;

      inflight = 1;
    }
  }

  return {
    play: function() {
      paused = false;
      writeMore();
    },
    pause: function() {
      paused = true;
    },
    stats: function() {
      return {
        host: host,
        port: port,
        opts: opts,
        paused: paused,
        inflight: inflight,
        totRequests: totRequests
      }
    }
  }
}

// ----------------------------------------------------

// var opts = { out: false, maxGoodKey: 1000 };
// for (var i = 0; i < 10; i++) {
//   startAsciiDataClient('127.0.0.1', 11211, i, opts);
// }

// var opts = { out: true, statsSubCommand: 'proxy' };
// startAsciiStatsClient('127.0.0.1', 11211, opts);

