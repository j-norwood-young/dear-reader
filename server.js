var config = require("./config");
var restify = require("restify");
var RedisSessions = require("redis-sessions");
var jwt = require("jsonwebtoken");
var randomstring = require("randomstring");
var mongoose   = require('mongoose');
var request = require("request");
var cheerio = require("cheerio");
var md5 = require("md5");
var Q = require("q");
var moment = require("moment");
var async = require("async");
var payments = require("./payments/payments");

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
	message.kicker = req.body.kicker;
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

var getDateRange = function() {
	console.time("getDateRange");
	var start = null;
	var end = null;
	return Log.findOne().select("date").sort({ "date": 1 }).exec()
	.then(function(result) {
		start = result.date;
		return Log.findOne().select("date").sort({ "date": -1 }).exec();
	})
	.then(function(result) {
		end = result.date;
		var diff = moment(end).diff(moment(start), "days");
		console.timeEnd("getDateRange");
		return { start: start, end: end, diff: diff };
	})
	;
};

var getDataByDate = function(date) {
	var mdate = moment(date);
	console.time("getDataByDate " + date);
	return Log.find({ 
		date: { $gte: mdate.format("YYYY-MM-DD"), $lte: mdate.format("YYYY-MM-DD") }
	}).sort({ "date": 1 }).exec();
};

var runQueue = function(queue) {
	var deferred = Q.defer();
	async.series(queue, function(err, result) {
		if (err) {
			console.error(err);
			return deferred.reject(err);
		}
		return deferred.resolve(result);
	});
	return deferred.promise;
};

server.get("/stats", function(req, res, next) {
	console.time("stats");
	var o = { limit: 1000 };
	var count = 0;
	o.map = function() {
		emit(this.ip_address + this.user_agent, 1);
	};
	o.reduce = function(key, values) {
		var sum = 0;
		values.forEach(function(doc) {
			sum++;
		});
		return sum;
	};
	var queue = [];
	getDateRange()
	.then(function(result) {
		var range = result;
		for(var x = 0; x < range.diff; x++) {
			var date = moment(range.start).add(x, "days");
			queue.push(function(callback) { //jshint ignore:line
				return function() { //jshint ignore:line
					console.log(date);
					getDataByDate(date)
					.then(function(result) {
						var reduced = result.map(function(item) {
							return md5(item.ip_address + item.user_agent);
						}).reduce(function(prev, current) {
							if (!prev[current]) {
								prev[current] = 1;
							} else {
								prev[current]++;
							}
							return prev;
						}, {});
						var o = {};
						o[date.format("YYYY-MM-DD")] = reduced;
						callback(null, o);
					}, function(err) {
						callback(err);
					});
				};
			});
		}
		queue.splice(0,3); //Testing
		return runQueue(queue);
	})
	.then(function(result) {
		console.log(result);
		res.send(result);
	})
	.then(null, function(err) {
		console.error(err);
		res.send(500, { status: "error", message: err });
	});
	// Log.count().then(function(result) {
	// 	count = result;
	// 	return Log.mapReduce(o);
	// }).then(function(unique) {
	// 	var uniqueCount = unique.length;
	// 	console.timeEnd("stats");
	// 	res.send({
	// 		status: "ok",
	// 		count: count,
	// 		uniqueCount: uniqueCount
	// 	});
	// }, function(err) {
	// 	console.error(err);
	// 	res.send(500, { status: "error", message: err });
	// });
});

server.get("/payment", payments.index);
server.post("/payment/confirm", payments.confirm);

server.listen(config.port, function() {
	console.log("%s listening at %s", server.name, server.url);
});