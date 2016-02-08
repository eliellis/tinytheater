#!/usr/bin/env node
const server = require('./lib/server.js');
const yts = require('./lib/yts-api/yts-api.js');
const tv = require('./lib/tv-api/tv-api.js');

const humanize = require('humanize');
const keypress = require('keypress');
const openUrl = require('open');
const request = require('request');
const toascii = require('image-to-ascii');
const inquirer = require('inquirer');
const clivas = require('clivas');
const strike = require('strike-api');
const omdb = require('omdb');
const program = require('commander');
const readline = require('readline');
const WebTorrent = require('webtorrent');

var buffered = false;
const BUFFERING_SIZE = 10 * 1024 * 1024;
const client = new WebTorrent({
  maxConns: 500,
});

program
.version('0.0.1')
.option('-m, --movie [name]', 'Search for a movie by its title.')
.option('-t, --television [name]', 'Search for a television series by its title.')
.option('-l, --link [torrent]', 'Stream torrent.')
.option('-v, --verbose', 'Print everything that\'s going on.')
.parse(process.argv);

process.on('SIGINT', () => {
  client.destroy();
});

var ui = new inquirer.ui.BottomBar();

if (program.movie)
{
  omdb.get(program.movie, { tomatoes: true, fullPlot: true }, (err, movie) => {
    clivas.clear();
    if (!err) {
      printMovie(movie);

      yts.listMovies({query_term: movie.title}).then((res) => {

        var allTorrents = res.data.movies[0].torrents;

        var torrentsList = allTorrents.map((item, i) => {
          return { name : `${item.quality} | ${item.size} | ${item.seeds} seeds | ${item.peers} leeches`, value: i };
        });
        
        inquirer.prompt([
          {
            type: 'list',
            name: 'torrent',
            message: 'Which torrent would you like to stream?',
            choices: torrentsList
          }
        ], function(answer){
          if (answer.trailer) {
            var trailer = res.data.movies[0].yt_trailer_code;
            openUrl(`http://youtube.com/watch?v=${trailer}`)
          }

          client.add(allTorrents[answer.torrent].url);
        });
          
      });
    }
    else {
      clivas.line(err);
    }
  });
}
else if (program.television)
{
  omdb.get(program.television, { tomatoes: true, fullPlot: true }, (err, show) => {
    clivas.clear();
    printShow(show);

    tv.getShow(show.imdb.id)
    .then((show) => {
      var seasonsList = {};

      for (var i = 0; i < show.episodes.length; i++) {
        var episode = show.episodes[i];
        var season = show.episodes[i].season; //arrays are 0-index, so normalize the season number

        if (!Array.isArray(seasonsList[season]))
        {
          seasonsList[season] = [];
        }

        seasonsList[season].push(episode);
      }

      var prompts = [
        {
          type: 'list',
          name: 'season',
          message: 'Which season would you like to stream?',
          choices: (answers) => {
            var seasons = [];
            for (key of Object.keys(seasonsList))
            {
              seasons.push({ name: `Season ${key}`, value: key });
            }
            return seasons;
          }
        },
        {
          type: 'list',
          name: 'episode',
          message: 'Which episode would you like to stream?',
          choices: (answers) => {
            return seasonsList[answers.season].map((item, i) => {
              return { name: `${i + 1}. ${item.title}`, value: i };
            });
          }
        },
        {
          type: 'list',
          name: 'torrent',
          message: 'Which torrent would you like to stream?',
          when: (answers) => {
            return Object.keys(seasonsList[answers.season][answers.episode].torrents).length > 2;
          },
          choices: (answers) => {
            var torrents = [];
            var i = 0;

            for (key of Object.keys(seasonsList[answers.season][answers.episode].torrents)) {
              torrents.push({ name: `${key}`, value: key});
              i++
            }

            torrents.splice(0, 1);

            return torrents;
          }
        }
      ];

      inquirer.prompt(prompts, function(answers){
        var torrent = '0';
        if (answers.torrent) torrent = answers.torrent;
        client.add(seasonsList[answers.season][answers.episode].torrents[torrent].url);
      });
    })
    .fail((err) => {
      clivas.line(`{red+bold:${err}}`);
    })

  });
}
else if (program.link)
{
  client.add(program.link);
}


client.on('torrent', (torrent) => {
  var vids = server.findMovieInTorrent(torrent.files);
  var file;
  inquirer.prompt([
    {
      type: 'list',
      name: 'file',
      message: 'Which file would you like to stream?',
      choices: function() {
        return vids.map((file, i) => {
          return { name: file.name, value: i }
        });
      },
      when: function() {
        return vids.length > 1;
      },
      default: 0
    }
  ], function(answer){
    var f = Object.keys(answer).length == 0 ? 0 : answer.file;
    var s = server.createServer(vids[f]);
    s.listen(() => {
      console.log()
      var port = s.address().port;

      clivas.line(`{underline+bold:Serving movie at http://localhost:${port}}`);

      torrent.on('download', (chunk) => {
        var buffered_percent = torrent.downloaded / (torrent.length / 100);
        ui.updateBottomBar(`Buffering... ${Math.floor(buffered_percent)}%`);
        if (buffered_percent >= 20)
        {
          ui.updateBottomBar(`${Math.floor(100 * torrent.progress)}% downloaded at ${humanize.filesize(torrent.downloadSpeed())}/s`);
          if (buffered == false)
          {
            openUrl(`http://localhost:${port}`);
            buffered = true;
          }
        }
      });
    });
  });
  

  
});


var printShow = function printShow(show)
{
  clivas.clear();
  clivas.line(`{gray+bold:${show.title}}`);
  clivas.line(`{yellow:IMDB rating: ${show.imdb.rating}}`);
  clivas.line(`{gray:${show.plot}}`);
}



var printMovie = function printMovie(movie)
{
  if (movie.poster)
  {
    toascii({path: movie.poster, size: { height: "50%" }}, function(err, response){
      console.log(err || response);
      printInfo();
    });
  }
  else
  {
    printInfo();
  }

  var printInfo = () => {
    clivas.clear();
    clivas.line(`{gray+bold:${movie.title}}`);
    if (movie.tomato) {
      clivas.line(`{red+bold:Rotten Tomatoes Score: ${movie.tomato.meter}%}`);
      clivas.line(`{red+bold:Rotten Tomatoes User Score: ${movie.tomato.userMeter}%}`);
    }
    clivas.line(`{gray:${movie.plot}}`);
  };
}


