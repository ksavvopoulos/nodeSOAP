var express = require('express'),
	register = require('./regDev.js'),
	app = express(),
	loggedUsers = [],
	ispringResults;

app.use(express.logger());

// Configuration

app.configure(function() {
	app.set('views', __dirname + '/app');
	//app.set('view engine', 'jade');

	app.use(express.bodyParser());
	app.use(express.cookieParser('adgfasldfihDIJEoisdkcnasjfdhiwer38e'));
	app.use(express.session());
	app.use(express.methodOverride());
	app.use(express.static(__dirname + '/app'));
	app.use(express.static(__dirname + '/app/ispring'));
	app.use(app.router);
	//app.engine('html');
});

app.set("view options", {
	layout: false
});

app.all('*', function(req, res, next) {
	res.header('Access-Control-Allow-Origin', req.headers.origin || "*");
	res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});

app.get('/', function(request, response) {
	response.sendfile('app/index.html');
});

app.get('/ispr', function(request, response) {
	response.sendfile('ispring/index.html');
});

app.get('/webPart', function(request, response) {
	response.sendfile('app/webpart.html');
});

app.post('/login', function(request, response) {
	var username = request.body.username,
		password = request.body.password,
		user = {
			username: username,
			password: password
		};

	register.registerDevice() //1
	.then(function(device) {
		return register.getToken(device); //2
	})
		.then(function(cipherValue) {
			return register.getTokenLiveId(cipherValue, user); //3
		})
		.then(function(options) {
			if (options.KeyIdentifier !== "" && options.CiperValue0 !== "" && options.CiperValue1 !== "") {
				request.session.regenerate(function() {
					request.session.user = username;
					loggedUsers.push({
						username: username,
						options: options
					});
					response.send({
						logged: true
					});
				});
			} else {
				response.send({
					logged: false
				});
			}
		},function(error){
			response.send({
					logged: false,
					error:error
				});
		});


});

function checkUser(user) {
	var i, len;

	for (i = 0, len = loggedUsers.length; i < len; i++) {
		if (loggedUsers[i].username === user) {
			return loggedUsers[i].options;
		}
	}

	return false;
}

app.get('/soap/entity/:entity/attribute', restrict, function(request, response) {
	var options;

	options = checkUser(request.session.user);

	if (options) {
		options.EntityName = request.params.entity;
		options.ColumnSet = [];

		register.retrieveMultiple(options)
			.then(function(results) {
					response.send(results);
				},
				function(err) {
					response.send(err);
				});

	} else {
		response.send([{
			userfound: false
		}]);
	}
});


app.get('/soap/retrieveAttribute/entity/:entity/attribute/:attribute', restrict, function(request, response) {
	var options;

	options = checkUser(request.session.user);

	if (options) {
		options.EntityName = request.params.entity;
		options.AttributeName = request.params.attribute;

		register.retrieveAttribute(options).then(function(results) {
			response.send(results);
		}, function(error) {
			response.send(error);
		});
	} else {
		response.send([{
			userfound: false
		}]);
	}
});

app.get('/ispringres', function(req, response) {

	response.send({
		res: ispringResults
	});
});

app.post('/ispring', function(request, response,next) {
	var body = request.body;

	ispringResults = {
		version: body.v,
		points: body.sp,
		passingPercent: body.psp,
		gainedScore: body.tp,
		username: body.sn,
		email: body.se,
		quizTitle: body.qt
	};

	response.send('ok');
	//response.redirect('http://ksavvas.azurewebsites.net/' + request.url);
});

app.get('/soap/entity/:entity/attribute/:attribute', restrict, function(request, response) {

	var options, columns;

	options = checkUser(request.session.user);

	if (options) {
		options.EntityName = request.params.entity;
		options.ColumnSet = [];
		columns = request.params.attribute.split(',');

		columns.forEach(function(v) {
			options.ColumnSet.push(v);
		});

		register.retrieveMultiple(options)
			.then(function(results) {
					response.send(results);
				},
				function(err) {
					response.send(err);
				});
	} else {
		response.send([{
			userfound: false
		}]);
	}
});

function restrict(request, response, next) {
	if (request.session.user) {
		next();
	} else {
		request.session.error = 'Access denied!';
		response.send("You must login");
	}
}


var port = process.env.PORT || 5000;

app.listen(port, function() {
	log('Listening on ' + port);
});

function log(mes) {
	process.stdout.write(mes + '\n');
}