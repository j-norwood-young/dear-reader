var fs = require("fs");
var _ = require("underscore");

var Templates = {
	render: function(template, data, cb) {
		fs.readFile(template, "utf8", (err, result) => {
			if (err) return cb(err);
			console.log(result);
			cb(null, result);
			// var template = _.template(result);
			// return template(data);
		});
	}
};

module.exports = Templates;