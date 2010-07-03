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

