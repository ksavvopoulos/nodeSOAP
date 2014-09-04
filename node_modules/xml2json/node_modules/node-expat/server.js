var express = require('express'),
	register = require('./regDev.js'),
	app = express();

app.use(express.logger());

// Configuration

app.configure(function () {
	app.set('views', __dirname + '/app');
	//app.set('view engine', 'jade');

	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.static(__dirname + '/app'));
	app.use(app.router);
	//app.engine('html');
});

app.set("view options", {layout: false});

app.get('/', function (request, response) {
	response.sendfile('app/index.html');
});

app.get('/webPart',function(request,response){
	response.sendfile('app/webpart.html');
});

app.get('/soap/ksavvas13',function(request,response){
	register.registerDevice(function (device) {
		register.getToken(device, function (cipherValue) {
			register.getTokenLiveId(cipherValue, function (options) {
				register.retrieveMultiple(options, function (results) {
					response.send(results);
				});
			});
		});
	});
});


var port = process.env.PORT || 5000;

app.listen(port, function () {
	log('Listening on ' + port);
});

function log(mes) {
    process.stdout.write(mes + '\n');
}