var exports = module.exports = {};
const hosts = ["tv-v2.api-fetch.website", // most recent popcorn time provider
                "www.popcorntime.ws/api/eztv/", 
                "odgoglfi7uddahby.onion.to", 
                "popcornwvnbg7jev.onion.to"];
const request = require('superagent');
const API_URLS = {
  getShow: `http://${ hosts[0] }/show/`,
  getShows: `http://${ hosts[0] }/shows/`
};

function* showUrl() {
  var index = 0;
  var url = `http://${ hosts[index] }/show/`;
  while (index < hosts.length) {
    yield url;
    index++;
    url = `http://${ hosts[index] }/show/`;
  }
  return url;
}

function* showsUrl() {
  var index = 0;
  var url = `http://${ hosts[index] }/shows/`;
  while (index < hosts.length) {
    yield url;
    index++;
    url = `http://${ hosts[index] }/shows/`;
  }
  return url;
}

exports.getShow = (imdb, opts) => {
  return new Promise((resolve, reject) => {
    let urls = showUrl();
    let retry = true;
    let url = urls.next();
    let r = (u) => { 
      request
      .get(u + imdb)
      .accept('json')
      .query(opts)
      .end((err, res) => {
        if (err && retry) {
          let n = urls.next();
          if (!n.done) {
            console.log(n);
            r(n.value);
          }
          else {
            retry = false;
          }
        }
        else if (err && !retry) {
          reject(new Error('Tried all hosts but failed.'));
        }
        else {
          if (res.body) {
            resolve(res.body);
          }
          else {
            reject(new Error("No show data recieved."));
          }
        }
      });
    };
    r(url.value);
  });
};

exports.getShows = (page, opts) => {
  return new Promise((resolve, reject) => {
    let url = showsUrl.next().value;
    request
    .get(url + page)
    .accept('json')
    .query(opts)
    .end((err, res) => {
      if (err) {
        reject(new Error(err));
      }
      else {
        if (res.body) {
          resolve(res.body);
        }
        else {
          reject(new Error("No show data recieved."));
        }
      }
    });
  });
};