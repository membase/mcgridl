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
exports.htons = function(b, i, v) {
  b[i]   = (0xff & (v >> 8));
  b[i+1] = (0xff & (v));
}

exports.ntohs = function(b, i) {
  return ((0xff & b[i + 0]) << 8) |
         ((0xff & b[i + 1]));
}

exports.ntohsStr = function(s, i) {
  return ((0xff & s.charCodeAt(i + 0)) << 8) |
         ((0xff & s.charCodeAt(i + 1)));
}

exports.htonl = function(b, i, v) {
  b[i+0] = (0xff & (v >> 24));
  b[i+1] = (0xff & (v >> 16));
  b[i+2] = (0xff & (v >> 8));
  b[i+3] = (0xff & (v));
}

exports.ntohl = function(b, i) {
  return ((0xff & b[i + 0]) << 24) |
         ((0xff & b[i + 1]) << 16) |
         ((0xff & b[i + 2]) << 8) |
         ((0xff & b[i + 3]));
}

exports.ntohlStr = function(s, i) {
  return ((0xff & s.charCodeAt(i + 0)) << 24) |
         ((0xff & s.charCodeAt(i + 1)) << 16) |
         ((0xff & s.charCodeAt(i + 2)) << 8) |
         ((0xff & s.charCodeAt(i + 3)));
}

