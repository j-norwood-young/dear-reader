"use strict";
var templates = require("../libs/templates");
var config = require("../config");
var md5 = require("md5");

var Payments = {
	index: function(req, res, next) {
		templates.render("index.html", { test: "blah" }, function(err, s) {
			res.send(s);	
		});
	},
	confirm: function(req, res, next) {
		var transaction_id = "12345";
		var advert_id = "45678";
		var organisation = {
			name: "Health-e",
			_id: "12345",
			email: "healthe@freespeechpub.co.za"
		};
		console.log(req.params);
		var paymentObj = {
			merchant_id: config.payfast.merchant_id,
			merchant_key: config.payfast.merchant_key,
			return_url: config.url + "/payments/return",
			cancel_url: config.url + "/payments/cancel",
			notify_url: config.url + "/payments/notify",
			name_first: req.params.name_first,
			name_last: req.params.name_last,
			email_address: req.params.email_address,
			m_payment_id: transaction_id,
			amount: req.params.amount,
			item_name: "Free Media Collective donation",
			item_description: "Donation to the Free Media Collective through " + organisation.name,
			custom_str1: organisation.name,
			custom_str2: config.url + "/transaction/" + transaction_id,
			custom_str3: config.url + "/advert/" + advert_id,
			custom_str4: config.url + "/organisation/" + organisation._id,
			email_confirmation: 1,
			confirmation_address: organisation.email,
		};
		var parts = [];
		for (let i in paymentObj) {
			parts.push(encodeURIComponent(paymentObj[i]));
		}
		paymentObj.signature = md5(parts.join("&"));
		var url = (config.payfast.testing) ? "https://sandbox.payfast.co.za/eng/process" : "https://www.payfast.co.za/eng/process";
		res.send({ url: url, form: paymentObj });
	}
};

module.exports = Payments;