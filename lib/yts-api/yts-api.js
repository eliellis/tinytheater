var exports = module.exports = {};

const host = "yts.ag";
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
  exports[method] = (query) => {
    return new Promise((resolve, reject) => {
      request
      .get(API_URLS[method])
      .accept('json')
      .query(query)
      .end((err, res) => {
        if (err)
        {
          reject(new Error(err));
        }
        else
        {
          resolve(res.body);
        }
      });
    });
  };
});