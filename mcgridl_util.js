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
    net = require('net');

// ----------------------------------------------------

exports.startAsciiDataClient = function(host, port, id, opts) {
  opts = opts || {};
  opts.dbg         = opts.dbg || false;
  opts.paused      = opts.paused || false;
  opts.maxInflight = opts.maxInFlight || 1;
  opts.maxGoodKey  = opts.maxGoodKey || 1000;
  opts.setRatio    = opts.setRatio || 0.10;
  opts.hitRatio    = opts.hitRatio || 0.90;

  var dbgPrefix = id + ': ';
  var dbgJoin   = '\r\n' + dbgPrefix;
  function dbg(str) {
    if (opts.dbg) {
      sys.log(dbgPrefix + str.split('\r\n').join(dbgJoin));
    }
  }

  var stream = net.createConnection(port, host);
  if (stream == null) {
    return false;
  }

  var paused = opts.paused;
  var inflight = 0;
  var nextGoodKey = 0;

  stream.setEncoding('binary');

  stream.addListener('connect', writeMore);
  stream.addListener('drain', writeMore);
  stream.addListener('error',
    function(ex) {
      dbg('EX: ' + ex);
    });
  stream.addListener('data',
    function(data) {
      dbg(data);
      inflight--;
      if (inflight < 0) {
        inflight = 0;
      }
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
    dbg(command);

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
    dbg(command);
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
    stop: function() {
      if (stream) {
        stream.close();
      }
      stream = null;
    },
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
  opts.dbg                 = opts.dbg || false;
  opts.paused              = opts.paused || false;
  opts.onStatsResult       = opts.onStatsResult || null;
  opts.statsSubCommand     = opts.statsSubCommand || null;
  opts.statsIntervalMillis = opts.statsIntervalMillis || 100;

  var statsSuffix = opts.statsSubCommand ? (' ' + opts.statsSubCommand) : '';

  var dbgPrefix = host + ":" + port + ": ";
  var dbgJoin   = '\r\n' + dbgPrefix;
  function dbg(str) {
    if (opts.dbg) {
      sys.log(dbgPrefix + str.split('\r\n').join(dbgJoin));
    }
  }

  var stream = net.createConnection(port, host);
  if (stream == null) {
    return false;
  }

  stream.setEncoding('binary');

  var paused = opts.paused;
  var inflight = 0;
  var totRequests = 0;
  var currResults = {};

  stream.addListener('data',
    function(data) {
      var a = data.split('\r\n');
      for (var i = 0; i < a.length; i++) {
        if (a[i] == 'END') {
          if (opts.onStatsResult) {
            opts.onStatsResult(handle, currResults);
          }
          currResults = {};
          inflight--;
        } else {
          var s = a[i].split(' '); // Ex: ['STAT', 'curr_items', '123'].
          currResults[s[1]] = s[2];
          dbg(a[i]);
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
      dbg(command);
      totRequests++;

      inflight = 1;
    }
  }

  var handle = {
    stop: function() {
      if (stream) {
        stream.close();
      }
      stream = null;
    },
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

  return handle;
}

// ----------------------------------------------------

// var opts = { dbg: false, maxGoodKey: 1000 };
// for (var i = 0; i < 10; i++) {
//   startAsciiDataClient('127.0.0.1', 11211, i, opts);
// }

// var opts = { dbg: true, statsSubCommand: 'proxy' };
// startAsciiStatsClient('127.0.0.1', 11211, opts);

