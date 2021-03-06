var debug = require('debug')('VersionOne'),
    request = require('superagent'),
    Q = require('q'),
    util = require('util'),
    V1Auth = require('./V1Auth');

function VersionOne(v1Auth) {
  this.v1Auth = v1Auth || new V1Auth();
  // this.loadSecrets();
  // this.refreshTokenDfd = Q.defer();
  // this.accessTokenDfd = Q.defer();
  // this.loadTokens();
}

VersionOne.prototype.loadSecrets = function () {
  try {
    var clientSecrets = JSON.parse(fs.readFileSync('client_secrets.json'));

    this.clientId = clientSecrets.web.client_id;
    this.clientName = clientSecrets.web.client_name;
    this.clientSecret = clientSecrets.web.client_secret;
    this.redirectUri = clientSecrets.web.redirect_uris[0];
    this.authUri = clientSecrets.web.auth_uri;
    this.tokenUri = clientSecrets.web.token_uri;
    this.serverBaseUri = clientSecrets.web.server_base_uri;

  } catch (err) {
    if (err.code && err.code === 'ENOENT') {
      err.message = "Couldn't find the client secrets file:: " + err.message;
    }
    if (err instanceof SyntaxError) {
      err.message = "Couldn't read the secrets. File isn't valid JSON:: " + err.message;
    }
    throw err;
  }
};

VersionOne.prototype.loadTokens = function () {
  try {
    var tokens = JSON.parse(fs.readFileSync('.tokens'));

    if (tokens && tokens.refreshToken) {
      this.refreshTokenDfd.resolve(tokens.refreshToken);
      delete this.refreshTokenDfd;
    }

    if (tokens && tokens.accessToken) {
      this.accessTokenDfd.resolve(tokens.accessToken);
      delete this.accessTokenDfd;
    }
  } catch (err) {
    if (err.code && err.code === 'ENOENT') {
      debug("Couldn't find the tokens file:: " + err.message);
    }
    if (err instanceof SyntaxError) {
      debug("Couldn't parse the tokens file:: " + err.message);
    }
  }
};

VersionOne.prototype.query = function (json) {
  debug('query');
  var dfd = Q.defer(),
      v1this = this;
  this.v1Auth.accessTokenP.then(function resolved(accessToken) {
    debug('query:accessTokenP:resolved');
    v1this.queryWithToken(json, accessToken).then(function resolved(response) {
      debug('query:queryWithToken:resolved');
      dfd.resolve(response);
    }, function rejected(err) {
      debug('query:queryWithToken:rejected');
      this.v1Auth.refresh();
      this.v1Auth.accessTokenP.then(function resolved(accessToken) {
        v1this.queryWithToken(json, accessToken).then(function resolved(response) {
          dfd.resolve(response);
        }, function rejected(err) {
          dfd.reject(err);
        });
      }, function rejected(err) {
        dfd.reject(err);
      });
    });
  }, function rejected(err) {
    dfd.reject(err);
  });
  return dfd.promise;
};

VersionOne.prototype.queryWithToken = function (jsonQuery, accessToken) {
  var dfd = Q.defer();
  debug('queryWithToken calling URL', this.serverBaseUri, '/query.v1');
  request
    .get(this.serverBaseUri + '/query.v1')
    .set('Authorization', 'Bearer ' + accessToken)
    .send(jsonQuery)
    .end(function (res) {
      if (res.ok) {
        dfd.resolve(res.body);
      } else {
        dfd.reject(new Error(res.text));
      }
    });

  return dfd.promise;
}

module.exports = VersionOne;