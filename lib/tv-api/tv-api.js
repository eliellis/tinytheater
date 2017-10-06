var exports = module.exports = {};
const hosts = ["www.popcorntime.ws/api/eztv/", 
                "odgoglfi7uddahby.onion.to", 
                "popcornwvnbg7jev.onion.to"];
const request = require('superagent');
const API_URLS = {
  getShow: `http://${hosts[0]}/show/`,
  getShows: `http://${hosts[0]}/shows/`
};

exports.getShow = (imdb, opts) => {
  return new Promise((resolve, reject) => {
    request
    .get(API_URLS.getShow + imdb)
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

exports.getShows = (page, opts) => {
  return new Promise((resolve, reject) => {
    request
    .get(API_URLS.getShows + page)
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
          reject(new Error("No show data recieved."))
        }
      }
    });
  });
};