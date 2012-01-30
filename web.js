require.paths.unshift(__dirname + '/lib');

var everyauth = require('everyauth');
var express   = require('express');

var MemoryStore = express.session.MemoryStore;
var sessionStore = new MemoryStore();
var parseCookie = require('connect').utils.parseCookie;
var Session = require('connect').middleware.session.Session;


var FacebookClient = require('facebook-client').FacebookClient;
global.facebook = new FacebookClient();

var uuid = require('node-uuid');

if(process.env.NODE_ENV == 'production'){
    
    /*process.env.FACEBOOK_APP_ID = '282893221758514';
    process.env.FACEBOOK_SECRET = '310405319ad39570bc381aa7105290ae';
    process.env.FACEBOOK_APP_URL = 'https://apps.facebook.com/memekombattwo/';*/
    process.env.FACEBOOK_APP_ID = '175839669190836';
    process.env.FACEBOOK_SECRET = '8a378661dd177e486956ffd27b02f4a6';
    process.env.FACEBOOK_APP_URL = 'https://apps.facebook.com/jogo-da-ket/';
    process.env.FACEBOOK_APP_HOME = 'https://jogo-da-ket.herokuapp.com/';
    //process.env.CDN = 'https://d24yrm0vsffrow.cloudfront.net/';
    process.env.CDN = process.env.FACEBOOK_APP_HOME;
    //mongoose.connect('mongodb://admin:passlikeaboss@ds029277.mongolab.com:29277/heroku_app2171098');
    
    
  }else{
    
    //require("v8-profiler");
    process.env.FACEBOOK_APP_ID = '236630266417484';
    process.env.FACEBOOK_SECRET = 'b3056774a559e31e09b8da8968f3d74c';
    process.env.FACEBOOK_APP_URL = 'https://apps.facebook.com/jogo-da-ket-test/';
    process.env.FACEBOOK_APP_HOME = 'http://localhost:3000/';
    process.env.CDN = process.env.FACEBOOK_APP_HOME;
    //mongoose.connect('mongodb://localhost/memekombat');
    
}

// configure facebook authentication
everyauth.facebook
  .appId(process.env.FACEBOOK_APP_ID)
  .appSecret(process.env.FACEBOOK_SECRET)
  .scope('publish_stream,publish_actions')
  .entryPath('/')
  .redirectPath(process.env.FACEBOOK_APP_URL)
  .findOrCreateUser(function() {
    return({});
  })

// create an express webserver
global.app = express.createServer(
  //express.logger(),
  express.errorHandler(),
  express.static(__dirname + '/public'),
  express.cookieParser(),
  // set this to a secret value to encrypt session cookies
  express.session({store: sessionStore, key: 'express.sid', secret: (process.env.SESSION_SECRET || 'secret123') }),
  // insert a middleware to set the facebook redirect hostname to http/https dynamically
  function(request, response, next) {
    var method = request.headers['x-forwarded-proto'] || 'http';
    everyauth.facebook.myHostname(method + '://' + request.headers.host);
    next();
  },
  everyauth.middleware(),
  require('facebook').Facebook()
);

if(process.env.NODE_ENV == 'production'){
    app.enable('view cache');
  }

// listen to the PORT given to us in the environment
var port = process.env.PORT || 3000;

app.listen(port, function() {
  console.log("Listening on " + port);
});

app.post('/', function(request, response){
  if (request.session.auth && request.session.logged) {
      response.redirect('/home');
  }else{
      var method = request.headers['x-forwarded-proto'] || 'http';
      var host = method + '://' + request.headers.host;
      request.session.logged = true;
      response.send('<script type="text/javascript">top.location.href = "'+host+'";</script>');
  }
  //response.render('index.ejs');
});

// create a socket.io backend for sending facebook graph data
// to the browser as we receive it
global.io = require('socket.io').listen(app);

// wrap socket.io with basic identification and message queueing
// code is in lib/socket_manager.js
global.socket_manager = require('socket_manager').create(io);

// use xhr-polling as the transport for socket.io
io.configure(function () {
  io.set("transports", ["xhr-polling"]);
  io.set("polling duration", 10);
});

io.set('authorization', function (data, accept) {
    if (data.headers.cookie) {
        data.cookie = parseCookie(data.headers.cookie);
        data.sessionID = data.cookie['express.sid'];
        // save the session store to the data object 
        // (as required by the Session constructor)
        data.sessionStore = sessionStore;
        sessionStore.get(data.sessionID, function (err, session) {
  
            if (err) {
                accept(err.message, false);
            } else {
                // create a session object, passing data as request and our
                // just acquired session data
                data.session = new Session(data, session);
                accept(null, true);
            }
        });

    } else {
       return accept('No cookie transmitted.', false);
    }
});

require('./controllers/home.js');
require('./controllers/server_sockets.js');
