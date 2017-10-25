const http = require('http');
const pump = require('pump');
const ffmpeg = require('fluent-ffmpeg'); // used for transcoding to h264/mp4 (web available format)
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
        res.setHeader('Content-Type', mime.getType('.mp4'));
        res.setHeader('transferMode.dlna.org', 'Streaming');
        res.setHeader('contentFeatures.dlna.org', 'DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=017000 00000000000000000000000000');

        if (!range) {
          res.setHeader('Content-Length', movieFile.length);
          if (req.method === 'HEAD') return res.end();
          pump(movieFile.createReadStream(range), res);
          return;
        }

        res.statusCode = 206;
        res.setHeader('Content-Length', range.end - range.start + 1);
        res.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + movieFile.length);
        if (req.method === 'HEAD') return res.end();
        pump(movieFile.createReadStream(range), res);

      });

      port.find({ min: 8000, max: 8080 })
      .then(port => {
        server.listen(port[0]);
      });

      return server;
    }
};

/**
 * returns a transcoder-stream stream with canned options
 * @param {ReadableStream} inputStream 
 */
function getTranscoderStream(inputStream, out) {
    let t = ffmpeg(inputStream)
    .videoCodec('libx264')
    .audioCodec('aac')
    .size('640x?')
    .addInputOption('-re')
    // .addOutputOption('-g', 52)
    .addOutputOption('-strict', 'experimental')
    // .addOutputOption('-movflags', 'faststart')
    .addOutputOption('-movflags', 'faststart+frag_keyframe+empty_moov')
    .format('mp4')
    .stream();
    return t;
}

exports.findMovieInTorrent = (files) => {
  return files.filter((file) => {
    if (mime.getType(file.name).includes("video"))
    {
      return true;
    }
    return false;
  });
}
