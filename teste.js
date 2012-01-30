require.paths.unshift(__dirname + '/lib');
var express   = require('express');

var app = express.createServer(
  //express.logger(),
  express.errorHandler(),
  express.static(__dirname + '/public'),
  express.cookieParser()
);

// listen to the PORT given to us in the environment
var port = process.env.PORT || 3000;

app.listen(port, function() {
  console.log("Listening on " + port);
});

app.all('/', function(req, res){
	res.render('teste.ejs', {
		
	});
});