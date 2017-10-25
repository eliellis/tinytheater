#!/usr/bin/env node
const server = require('./lib/server.js');
const config = require('./lib/config.js');
const yts = require('./lib/yts-api/yts-api.js');
const tv = require('./lib/tv-api/tv-api.js');
const debug = require('debug')('main');
const humanize = require('humanize');
const inquirer = require('inquirer');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
const clivas = require('clivas');
const imdb = require('imdb-api');
const program = require('commander');
const parseTorrent = require('parse-torrent');
const WebTorrent = require('webtorrent');
const img2ascii = require('image-to-ascii');

var buffered = false;
const TRACKERS_LIST = config.get('trackers');
const BUFFERING_SIZE = 10 * 1024 * 1024;
const client = new WebTorrent({
  maxConns: 500,
});
const ui = new inquirer.ui.BottomBar();
const apiKey = program.apiKey ? 
                program.apiKey 
                : config.get('apiKey') === null ? '' : config.get('apiKey');

program
.version('0.0.1')
.usage('<command>')
.option('--api-key [key]', 'API key for Open Movie Database.');

function movieQuestionarreHandler(req) {
  imdb
  .getReq(Object.assign(req, { opts: {apiKey} }))
  .then((movie) => {
    clivas.clear();
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
      ]).then(function(answer){
        if (answer.trailer) {
          var trailer = res.data.movies[0].yt_trailer_code;
          openUrl(`http://youtube.com/watch?v=${trailer}`);
        }
        magnet = parseTorrent.toMagnetURI({
          infoHash: allTorrents[answer.torrent].hash,
          announce: TRACKERS_LIST,
          name: res.data.movies[0].title
        });
        // console.log(magnet);
        client.add(magnet);
      });
        
    });
  }).catch(err => clivas.line(err));
}
program
.command('movie <name>')
.description('Search for a movie by its title.')
.action(name => {
  movieQuestionarreHandler({ name });
});

function seriesQuestionnareHandler(req) {
  imdb
  .getReq(Object.assign(req, { opts: { apiKey } }))
  .then((show) => {
        clivas.clear();
        printShow(show);

        tv.getShow(show.imdbid)
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
                for (let key of Object.keys(seasonsList))
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
                return Object.keys(seasonsList[answers.season][answers.episode].torrents).length > 1;
              },
              choices: (answers) => {
                var torrents = [];
                var i = 0;

                for (let key of Object.keys(seasonsList[answers.season][answers.episode].torrents)) {
                  torrents.push({ name: `${key}`, value: key});
                  i++;
                }

                torrents.splice(0, 1);

                return torrents;
              }
            }
          ];

          inquirer.prompt(prompts).then(function(answers){
            var torrent = '0';
            if (answers.torrent) torrent = answers.torrent;
            client.add(seasonsList[answers.season][answers.episode].torrents[torrent].url);
          });
        });
    }).catch(err => clivas.line(err));
}
program
.command('television <name>')
.alias('tv')
.description('Search for a series by its title.')
.action(name => {
  seriesQuestionnareHandler({ name });
});

program
.command('search [term]')
.alias('s')
.description('Begin interactive session.')
.action((term) => {
  inquirer.prompt([{
    type: 'autocomplete',
    name: 'title',
    message: 'Search for a show or movie',
    source: function(answersSoFar, input) {
      return new Promise((resolve, reject) => {
        imdb.search({ title: input || '' }, { apiKey }).then((res) => {
          let list = res.results.map((result) => { return { name: `${ result.title } | ${ result.type } | ${ result.year }`, value: result }; });
          if (list.length > 0) {
            resolve(list);
          }
          else {
            resolve([]);
          }
        }).catch(err => resolve([]));
      });
    }
  }]).then(function(answers) {
    if (answers.title.type === 'movie') {
      movieQuestionarreHandler({ id: answers.title.imdbid });
    }
    else if (answers.title.type === 'series') {
      seriesQuestionnareHandler({ id: answers.title.imdbid });
    }
  }).catch(err => console.log(err));
});

program
.command('link <name>')
.alias('l')
.description('Just add a magnet link.')
.action(link => {
  client.add(link);
});

program.command('apikey <key>')
.alias('api')
.description('Sets and saves your OMDB api key.')
.action(value => {
  config.set('apiKey', value).then(() => { 
    clivas.line('Saved API key.');
    process.emit('SIGINT');
  });
});

program.parse(process.argv);

process.on('SIGINT', () => {
  client.destroy();
  process.exit(0);
});

client.on('error', err => {
  clivas.line(err);
});

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
          return { name: file.name, value: i };
        });
      },
      when: function() {
        
        return vids.length > 1;
      },
      default: 0
    }
  ]).then(function(answer) {
    debug('creating server...');

    var f = Object.keys(answer).length == 0 ? 0 : answer.file;
    var s = server.createServer(vids[f]);
    s.on('listening', () => {
      var port = s.address().port;
      clivas.line(`{underline+bold:Serving movie at http://localhost:${ port }}`);

      debug('torrent downloading...');
      torrent.on('download', (chunk) => {
        var buffered_percent = torrent.downloaded / (torrent.length / 100);
        avgSpeed(torrent.downloadSpeed);
        ui.updateBottomBar(`Buffering... ${Math.floor(buffered_percent)}%`);
        if (buffered_percent >= 20)
        {
          ui.updateBottomBar(`${ Math.floor(100 * torrent.progress) }% downloaded at ${ humanize.filesize(avgSpeed(torrent.downloadSpeed)) }/s`);
          if (buffered == false)
          {
            buffered = true;
          }
        }
      });
    });
  });
  

  
});

let speedBuffer = Array();
let avgSpeed = (speed) => {
  debug('average speed %o', speedBuffer);
  if (speedBuffer.length < 11) {
    speedBuffer.push(speed);
  }
  speedBuffer.splice(0, 1);
  speedBuffer.push(speed);
  return speedBuffer.reduce((a, b) => (a + b) / 2);
};

var printShow = function printShow(show)
{
  debug('printing show info for %o', show.title);
  clivas.clear();
  clivas.line(`{gray+bold:${ show.title }}`);
  show.ratings.forEach((rating) => {
    clivas.line(`{yellow:${ rating.Source } rating: ${ rating.Value }}`);
  });
  clivas.line(`{gray:${show.plot}}`);
};



var printMovie = function printMovie(movie)
{
  debug('printing movie info for movie %o', movie.title);
  clivas.clear();
  clivas.line(`{gray+bold:${ movie.title }}`);
  if (movie.tomato) {
    clivas.line(`{red+bold:Rotten Tomatoes Score: ${ movie.tomato.meter }%}`);
    clivas.line(`{red+bold:Rotten Tomatoes User Score: ${ movie.tomato.userMeter }%}`);
  }
  clivas.line(`{gray:${movie.plot}}`);
};


