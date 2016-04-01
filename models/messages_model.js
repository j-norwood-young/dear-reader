var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;

var MessagesSchema   = new Schema({
	message: String,
	kicker: String,
	start_date: { type: Date, default: Date.now },
	end_date: Date,
	date_created: { type: Date, default: Date.now },
	views: { type: Number, default: 1 },
	clicks: { type: Number, default: 1 },
	hides: { type: Number, default: 0 }
});

module.exports = mongoose.model('Messages', MessagesSchema);