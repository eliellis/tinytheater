var exports = module.exports = {};

const host = "yts.ag";
const Q = require('Q');
const request = require('superagent');
const API_URLS = {
  listMovies: `https://${host}/api/v2/list_movies.json`,
  movieDetails: `https://${host}/api/v2/movie_details.json`,
  movieSuggestions: `https://${host}/api/v2/movie_suggestions.json`,
  movieComments: `https://${host}/api/v2/movie_comments.json`,
  movieReviews: `https://${host}/api/v2/movie_reviews.json`,
  movieParentalGuides: `https://${host}/api/v2/movie_parental_guides.json`
};

Object.keys(API_URLS).forEach((method) => {
  exports[method] = (q) => {
    var deferred = Q.defer();
    request
    .get(API_URLS[method])
    .accept('json')
    .query(q)
    .end((err, res) => {
      
      if (err)
      {
        deferred.reject(new Error(err));
      }
      else
      {
        deferred.resolve(res.body);
      }
    });
    return deferred.promise;
  }
});