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

var opts;

opts = { out: false, maxGoodKey: 1000 };

for (var i = 0; i < 10; i++) {
  mcgridl_util.startAsciiDataClient('127.0.0.1', 11211, i, opts);
}

opts = { out: true, statsSubCommand: 'proxy' };

mcgridl_util.startAsciiStatsClient('127.0.0.1', 11211, '', opts);


