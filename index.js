#!/usr/bin/env node
const server = require('./lib/server.js');
const yts = require('./lib/yts-api/yts-api.js');
const tv = require('./lib/tv-api/tv-api.js');

const jsonfile = require('jsonfile');
const humanize = require('humanize');
const openUrl = require('open');
const inquirer = require('inquirer');
const clivas = require('clivas');
const imdb = require('imdb-api');
const program = require('commander');
const parseTorrent = require('parse-torrent');
const WebTorrent = require('webtorrent');

var buffered = false;
const TRACKERS_LIST = [
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:80',
  'udp://tracker.coppersurfer.tk:6969',
  'udp://glotorrents.pw:6969/announce',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://torrent.gresille.org:80/announce',
  'udp://p4p.arenabg.com:1337',
  'udp://tracker.leechers-paradise.org:6969'
];
const BUFFERING_SIZE = 10 * 1024 * 1024;
const client = new WebTorrent({
  maxConns: 500,
});
const ui = new inquirer.ui.BottomBar();
const config = jsonfile.readFileSync('config.json', { throws: false });
const apiKey = program.apiKey ? 
                program.apiKey 
                : config === null ? '' : config.apiKey;

program
.version('0.0.1')
.usage('<command>')
.option('--api-key [key]', 'API key for Open Movie Database.');

program
.command('movie <name>')
.description('Search for a movie by its title.')
.action(name => {
  imdb
  .get(name, { apiKey })
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
});

program
.command('television <name>')
.alias('tv')
.description('Search for a series by its title.')
.action(name => {
  imdb
  .get(name, { apiKey })
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
                return Object.keys(seasonsList[answers.season][answers.episode].torrents).length > 2;
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
.action(key => {
  if (key.length > 0) {
    jsonfile.writeFile('config.json', { apiKey: key }, err => {
      if (!err) {
        clivas.line('Saved your api-key!');
        process.emit('SIGINT');
      }
    });
  }
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
    var f = Object.keys(answer).length == 0 ? 0 : answer.file;
    var s = server.createServer(vids[f]);
    s.on('listening', () => {
      var port = s.address().port;

      clivas.line(`{underline+bold:Serving movie at http://localhost:${port}}`);

      torrent.on('download', (chunk) => {
        var buffered_percent = torrent.downloaded / (torrent.length / 100);
        ui.updateBottomBar(`Buffering... ${Math.floor(buffered_percent)}%`);
        if (buffered_percent >= 20)
        {
          ui.updateBottomBar(`${ Math.floor(100 * torrent.progress) }% downloaded at ${ humanize.filesize(torrent.downloadSpeed) }/s`);
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
  show.ratings.forEach((rating) => {
    clivas.line(`{yellow:${ rating.Source } rating: ${ rating.Value }}`);
  });
  clivas.line(`{gray:${show.plot}}`);
};



var printMovie = function printMovie(movie)
{
  clivas.clear();
  clivas.line(`{gray+bold:${movie.title}}`);
  if (movie.tomato) {
    clivas.line(`{red+bold:Rotten Tomatoes Score: ${movie.tomato.meter}%}`);
    clivas.line(`{red+bold:Rotten Tomatoes User Score: ${movie.tomato.userMeter}%}`);
  }
  clivas.line(`{gray:${movie.plot}}`);
};


