var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Mixed = mongoose.Schema.Types.Mixed;

var LogSchema   = new Schema({
	date: { type: Date, default: Date.now },
	url: String,
	referer: String,
	origin: String,
	user_agent: String,
	ip_address: String,
	headers: Mixed,
});

module.exports = mongoose.model('Log', LogSchema);