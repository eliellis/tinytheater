const http = require('http');
const pump = require('pump');
const rangeParser = require('range-parser');
const mime = require('mime');
const port = require('portastic');

var exports = module.exports = {};

exports.createServer = (file) => {
    var movieFile = file;
    if (movieFile != null)
    {
      var server = http.createServer();

      server.on('request', (req, res) => {
        var range = req.headers.range;
        range = range && rangeParser(movieFile.length, range)[0];
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', mime.getType(movieFile.name));
        res.setHeader('transferMode.dlna.org', 'Streaming');
        res.setHeader('contentFeatures.dlna.org', 'DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=017000 00000000000000000000000000');
        
        if (!range) {
          res.setHeader('Content-Length', movieFile.length);
          if (req.method === 'HEAD') return res.end();
          pump(movieFile.createReadStream(range), res);
          return
        }

        res.statusCode = 206
        res.setHeader('Content-Length', range.end - range.start + 1);
        res.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + movieFile.length);
        if (req.method === 'HEAD') return res.end();
        pump(movieFile.createReadStream(range), res);

      });
      
      return server;
    }
}

exports.findMovieInTorrent = (files) => {
  return files.filter((file) => {
    if (mime.getType(file.name).includes("video"))
    {
      return true
    }
    return false;
  });
}
