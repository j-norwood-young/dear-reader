var config = require("./config");
var restify = require("restify");
var RedisSessions = require("redis-sessions");
var jwt = require("jsonwebtoken");
var randomstring = require("randomstring");
var mongoose   = require('mongoose');
var request = require("request");
var cheerio = require("cheerio");
var md5 = require("md5");

mongoose.connect('mongodb://' + config.mongo.server + '/' + config.mongo.db, function(err) {
    if (err) {
        console.log("Connection error", err);
    }
    console.log("Connected to Mongo DB", config.mongo.db);
}, { db: { safe:true } }); // connect to our database

var Messages = require("./models/messages_model");
var Log = require("./models/log_model");

var server = restify.createServer();
var sessions = new RedisSessions();

function generateToken(req, res, next) {
	sessions.create({
		app: config.name,
		id: "unregistered",
		ip: req.connection.remoteAddress,
		ttl: 3600,
		d: req.body
	},
	function(err, resp) {
		if (err) {
			console.log("Error", err);
			return res.send(500, err);
		}
		return res.send(resp);
	});
	next();
}

var log = function(req, res, next) {
	var log = new Log();
	log.url = req.url;
	log.referer = req.headers.referer;
	log.origin = req.headers.origin;
	log.user_agent = req.headers['user-agent'];
	log.ip_address = req.connection.remoteAddress;
	log.headers = req.headers;
	log.save();
	next();
};

var secure = function(req, res, next) {
	if (!req.headers.authorization) {
		res.send(401, { status: "denied" });
		return;
	}
	try {
		auth = req.headers.authorization.split(" ")[1];
		// console.log("Auth", auth);
		decoded = new Buffer(auth, 'base64').toString();
		// console.log("Decoded", decoded);
		var parts = decoded.split(":");
		// console.log(config.admin);
		if ((parts[0] === config.admin.username) && (parts[1] === config.admin.password)) {
			// console.log("Pass");
			req.isLoggedIn = true;
			return next();
		}
	} catch(err) {
		res.send(500, { status: "denied" });
		return;
	}
	res.send(500, { status: "denied"} );
};

server.use(restify.queryParser());
server.use(restify.bodyParser());

server.use(
	function crossOrigin(req,res,next){
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Headers", "X-Requested-With");
		return next();
	}
);

server.get(/\/public\/?.*/, restify.serveStatic({
	directory: __dirname
}));

server.get("/token", log, generateToken);

server.post("/token", log, function(req, res, next) {
	var data = {};
	try {
		data = JSON.parse(req.body);
	} catch(e) {
		return res.send(400, "could not parse JSON");
	}
	if (!data.token) {
		return res.send(400, "token required");
	}
	sessions.get({
		app: config.name,
		token: data.token
	}, function(err, result) {
		console.log(result);
	});
	res.send({ status: "ok" });
});

var viewMessage = function(_id) {
	Messages.findOne({ _id: _id })
	.then(function(message) {
		console.log("Viewing message", message);
		message.views++;
		message.save();
	});
};

var clickMessage = function(_id) {
	Messages.findOne({ _id: _id })
	.then(function(message) {
		console.log("Click!", message.message);
		message.clicks++;
		message.save();
	});
};

/*
 * Get Message
 * 
 * Uses a multi-armed bandit strategy to a/b test this mofo
 */
server.get("/message/rand", log, function(req, res, next) {
	Messages.find()
	.then(function(results) {
		var message = {};
		//Are we going to do a random selection?
		var rand = Math.random();
		// console.log(rand);
		if (rand <= config.randomChance) {
			console.log("Random!");
			message = results[Math.floor(Math.random()*results.length)];
			// console.log(message);
			res.send({
				id: message._id,
				message: message.message,
				kicker: message.kicker
			});
			return;
		}
		calculated = results.map(function(message) {
			return {
				_id: message._id,
				message: message.message,
				kicker: message.kicker,
				score: message.clicks / message.views
			};
		});
		calculated.sort(function(a, b) {
			return (a.score > b.score) ? 1 : -1;
		});
		console.log(calculated);
		message = calculated.pop();
		viewMessage(message._id);
		res.send({
			id: message._id,
			message: message.message,
			kicker: message.kicker
		});
	});
});

server.get("/click/:id", log, function(req, res, next) {
	clickMessage(req.params.id);
	res.send("Okay");
});

server.get("/message", secure, log, function(req, res, next) {
	Messages.find()
	.then(function(results) {
		res.send(results);
	}, function(err) {
		res.send(500, { status: "error", error: err });
	});
});

server.post("/message", secure, log, function(req, res, next) {
	// var data = JSON.parse(req.body);
	console.log("Posting to messages", req.body);
	var message = new Messages();
	message.message = req.body.message;
	message.start_date = req.body.start_date || null;
	message.end_date = req.body.end_date || null;
	message.save()
	.then(function(result) {
		res.send({ status: "ok", message: "Saved new message" });
	}, function(err) {
		res.send(500, { status: "failed", message: err });
	});
});

server.get("/message/:id", secure, log, function(req, res, next) {
	Messages.findOne({ _id: req.params.id })
	.then(function(message) {
		if (!message) {
			res.send(404, { status: "not found", message: "Failed to find message " + req.params.id });
		}
		res.send(message);
	}, function(err) {
		res.send(404, { status: "error", message: "Failed to find message " + req.params.id });
	});
});

server.put("/message/:id", secure, log, function(req, res, next) {
	Messages.findOne({ _id: req.params.id })
	.then(function(message) {
		for (var i in req.body) {
			message[i] = req.body[i];
		}
		return message.save();
	})
	.then(function(result) {
		res.send({ status: "ok", message: "Message updated", data: result });
	}, function(err) {
		res.send(500, { status: "error", message: "Failed to update message " + req.params.id });
	});
});

server.del("/message/:id", secure, log, function(req, res, next) {
	Messages.findOne(req.params.id)
	.then(function(message) {
		return message.remove();
	})
	.then(function(result) {
		res.send({ status: "ok", message: "Message deleted" });
	}, function(err) {
		res.send(500, { status: "error", message: "Failed to delete message " + req.params.id });
	});
});

server.post("/page", secure, log, function(req, res, next) {

});

server.get("/page/sales", log, function(req, res, next) {
	var url = "http://www.groundup.org.za/donate/";
	request(url, function(error, response, html) {
		if (error) {
			return res.send({ status: "error", message: error });
		}
		var $ = cheerio.load(html);
		var article = $("article");
		res.send({ status: "ok", data: article.html() });
	});
});

server.get("/stats", secure, function(req, res, next) {
	Log.find().then(function(result) {
		var count = result.length;
		var unique = result.map(function(item) {
			return md5(item.ip_address + item.user_agent);
		}).reduce(function(previousValue, currentValue, index, context) {
			if (previousValue.indexOf(currentValue) === -1) {
				previousValue.push(currentValue);
			}
			return previousValue;
		}, []);
		var uniqueCount = unique.length;
		res.send({
			status: "ok",
			count: count,
			uniqueCount: uniqueCount
		});
	});
});

server.listen(config.port, function() {
	console.log("%s listening at %s", server.name, server.url);
});