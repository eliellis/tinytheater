var exports = module.exports = {};
const hosts = ["www.popcorntime.ws/api/eztv/", 
                "odgoglfi7uddahby.onion.to", 
                "popcornwvnbg7jev.onion.to"];
const Q = require('Q');
const request = require('superagent');
const API_URLS = {
  getShow: `http://${hosts[0]}/show/`,
  getShows: `http://${hosts[0]}/shows/`
};

exports.getShow = (imdb, opts) => {
  var def = Q.defer();
  request
  .get(API_URLS.getShow + imdb)
  .accept('json')
  .query(opts)
  .end((err, res) => {
    if (err) {
      def.reject(new Error(err));
    }
    else {
      if (res.body) {
        def.resolve(res.body);
      }
      else {
        def.reject(new Error("No show data recieved."))
      }
    }
  });
  return def.promise;
};

exports.getShows = (page, opts) => {
  var def = Q.defer();
  request
  .get(API_URLS.getShows + page)
  .accept('json')
  .query(opts)
  .end((err, res) => {
    if (err) {
      def.reject(new Error(err));
    }
    else {
      if (res.body) {
        def.resolve(res.body);
      }
      else {
        def.reject(new Error("No show data recieved."))
      }
    }
  });
  return def.promise;
};