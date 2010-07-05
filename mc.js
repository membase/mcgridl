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
 Buffer = require('buffer').Buffer;

var n = require('./ntoh'),
    e = exports;

e.SIZEOF_HEADER = 24; // In bytes.

e.REQ_MAGIC_BYTE = 0x80;
e.RES_MAGIC_BYTE = 0x81;

e.CMD_GET = 0x00;
e.CMD_SET = 0x01;
e.CMD_ADD = 0x02;
e.CMD_REPLACE = 0x03;
e.CMD_DELETE = 0x04;
e.CMD_INCR = 0x05;
e.CMD_DECR = 0x06;
e.CMD_QUIT = 0x07;
e.CMD_FLUSH = 0x08;
e.CMD_GETQ = 0x09;
e.CMD_NOOP = 0x0a;
e.CMD_VERSION = 0x0b;
e.CMD_STAT = 0x10;
e.CMD_APPEND = 0x0e;
e.CMD_PREPEND = 0x0f;

e.CMD_TAP_CONNECT = 0x40;
e.CMD_TAP_MUTATION = 0x41;
e.CMD_TAP_DELETE = 0x42;
e.CMD_TAP_FLUSH = 0x43;
e.CMD_TAP_OPAQUE = 0x44;

e.TAP_FLAG_BACKFILL = 0x01
e.TAP_FLAG_DUMP = 0x02

// ------------------------------------

e.packHeader = function(magic, opcode, keylen,
                        extlen, datatype, statusOrReserved,
                        bodylen,
                        opaque) {
  var b = new Buffer(e.SIZEOF_HEADER + extlen + keylen);
  b[0] = magic;
  b[1] = opcode;
  n.htons(b, 2, keylen);
  b[4] = extlen;
  b[5] = datatype;
  n.htons(b, 6, statusOrReserved);
  n.htonl(b, 8, bodylen);
  n.htonl(b, 12, opaque);
  for (var i = 16; i < e.SIZEOF_HEADER; i++) {
    b[i] = 0;
  }
  return b;
}

e.unpackHeader = function(b, start) {
  if (b.length - start < e.SIZEOF_HEADER) {
    return -1;
  }

  var r = {
      magic: 0xff & b[start],
      opcode: 0xff & b[start + 1],
      keylen: n.ntohs(b, start + 2),
      extlen: 0xff & b[start + 4],
      statusOrReserved: n.ntohs(b, start + 6),
      bodylen: n.ntohl(b, start + 8),
      opaque: n.ntohl(b, start + 12)
  };

  r.datalen = r.bodylen - (r.keylen + r.extlen);

  return r;
}

e.unpackHeaderStr = function(b, start) {
  if ((b.length - start) < e.SIZEOF_HEADER) {
    return -1;
  }

  var r = {
      magic: 0xff & b.charCodeAt(start),
      opcode: 0xff & b.charCodeAt(start + 1),
      keylen: n.ntohsStr(b, start + 2),
      extlen: 0xff & b.charCodeAt(start + 4),
      statusOrReserved: n.ntohsStr(b, start + 6),
      bodylen: n.ntohlStr(b, start + 8),
      opaque: n.ntohlStr(b, start + 12)
  };

  r.datalen = r.bodylen - (r.keylen + r.extlen);

  if ((b.length - start) < (e.SIZEOF_HEADER + r.bodylen)) {
    return -1;
  }

  return r;
}

// ------------------------------------

e.packRequest = function(opcode, key, ext, reserved, opaque, data) {
  var keylen = (key || '').length;
  var extlen = (ext || '').length;
  var datalen = (data || '').length;
  var bodylen = keylen + extlen + datalen;

  var b = e.packHeader(e.REQ_MAGIC_BYTE, opcode, keylen,
                       extlen, 0, reserved,
                       bodylen, opaque);

  if (ext != null) {
    ext.copy(b, e.SIZEOF_HEADER, 0, extlen);
  }

  for (var i = 0; i < keylen; i++) {
    b[e.SIZEOF_HEADER + extlen + i] = key.charCodeAt(i);
  }

  return b;
}

// ------------------------------------

e.unpackMsgStr = function(s, start) {
  if (s.length - start < e.SIZEOF_HEADER) {
    return -1;
  }

  var r = e.unpackHeaderStr(s, start);
  if (r != -1) {
    r.ext = (r.extlen > 0 ?
             s.slice(start + e.SIZEOF_HEADER,
                     start + e.SIZEOF_HEADER + r.extlen) :
             null);
    r.key = (r.keylen > 0 ?
             s.slice(start + e.SIZEOF_HEADER + r.extlen,
                     start + e.SIZEOF_HEADER + r.extlen + r.keylen) :
             null);
    r.data = (r.datalen > 0 ?
              s.slice(start + e.SIZEOF_HEADER + r.extlen + r.keylen,
                      start + e.SIZEOF_HEADER + r.extlen + r.keylen + r.datalen) :
              null);
  }

  return r;
}

