(function() {
	var apiurl = "http://localhost:8080";
	var withinviewport = require("withinviewport");

	WebFontConfig = {
		google: { families: [ 'Playfair+Display::latin' ] }
	};
	(function() {
		var wf = document.createElement('script');
		wf.src = 'https://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js';
		wf.type = 'text/javascript';
		wf.async = 'true';
		var s = document.getElementsByTagName('script')[0];
		s.parentNode.insertBefore(wf, s);
	})();

	//Load CSS
	var cssLoader=document.createElement("link");
	cssLoader.setAttribute("rel", "stylesheet");
	cssLoader.setAttribute("type", "text/css");
	cssLoader.setAttribute("href", "http://dearreaderserver.dev/public/css/dearreader.css");
	document.body.appendChild(cssLoader);

	function hasClass(el, className) { //http://jaketrent.com/post/addremove-classes-raw-javascript/
		if (el.classList)
			return el.classList.contains(className);
		else
			return !!el.className.match(new RegExp('(\\s|^)' + className + '(\\s|$)'));
	}

	function addClass(el, className) {
		if (el.classList)
			el.classList.add(className);
		else if (!hasClass(el, className)) 
			el.className += " " + className;
	}

	function removeClass(el, className) {
		if (el.classList)
			el.classList.remove(className);
		else if (hasClass(el, className)) {
			var reg = new RegExp('(\\s|^)' + className + '(\\s|$)');
			el.className=el.className.replace(reg, ' ');
		}
	}

	var ajaxGet = function(endpoint, callback) {
		var oReq = new XMLHttpRequest();
		oReq.onload = function (e) {
			console.log(e.target);
			if (e.target.status !== 200)
				return callback(e.target.response);
			return callback(null, e.target.response);
		};
		console.log("Getting " + apiurl + "/" + endpoint);
		oReq.open('GET', apiurl + "/" + endpoint, true);
		oReq.responseType = 'json';
		oReq.send();
	};

	var ajaxPost = function(endpoint, data, callback) {
		console.log("Data", data);
		var oReq = new XMLHttpRequest();
		oReq.onload = function (e) {
			console.log(e.target);
			if (e.target.status !== 200)
				return callback(e.target.response);
			return callback(null, e.target.response);
		};
		console.log("POSTing " + apiurl + "/" + endpoint);
		oReq.open('POST', apiurl + "/" + endpoint, true);
		oReq.responseType = 'json';
		oReq.send(JSON.stringify(data));
	};

	var getDRToken = function() {
		ajaxGet("token", function(err, result) {
			if (err) {
				console.error(err);
				return;
			}
			console.log(result);
			var token = result.token;
			localStorage.setItem("token", token);
		});
	};

	var checkinDRToken = function(token) {
		ajaxPost("token", { token: token }, function(err, result) {
			if (err) {
				console.error(err);
				return;
			}
			console.log(result);
			// token = result.token;
			// localStorage.setItem("token", token);
		});
	};

	if(typeof(Storage) !== "undefined") {
	    var token = localStorage.getItem("token");
	    if (token) { // User has a DR account
	    	console.log("Had DR");
	    	checkinDRToken(token);
	    } else { // No DR account
	    	console.log("No DR");
	    	getDRToken();
	    }
	} else {
	    // Sorry! No Web Storage support..
	    console.log("No WebStorage support");
	}

	var trackElem = document.getElementById('DearReader');
	var elem = null;
	var message = {};
	var modal = null;

	getMessage = function() {
		ajaxGet("message/rand", function(err, result) {
			if (err) {
				console.error(err);
				return;
			}
			message = result;
			// console.log(message);
			elem = document.createElement("div");
			elem.id = "DearReaderAd";
			elem.innerHTML = "<div class='col-left'>Free Media</div><div class='col-mid'><strong>" + message.message + "</strong> <div id='DearReaderAction' class='kicker'>" + message.kicker + "</div></div><div class='col-right'><span id='DearReaderClose' class='close-button'>X</span></div>";
			//Style our message window
			elem.style.borderTop = "1px #AFC2D6 solid";
			elem.style.boxShadow = "0 0 6px rgba(0,0,0,0.24)";
			elem.style.padding = "5px";
			elem.style.position = "fixed";
			elem.style.bottom = "0px";
			elem.style.right = "0px";
			elem.style.left = "0px";
			elem.style.backgroundColor = "#cedff2";
			elem.style.color = "#000";
			elem.style.textAlign = "center";
			elem.style.zIndex = 10000;
			elem.style.fontFamily = "Playfair Display, Times New Roman, Times, serif";
			// elem.addEventListener("click", clickElement);
			elem.style.transitionProperty = "all";
			elem.style.transitionDuration = ".5s";
			elem.style.transitionTimingFunction = "cubic-bezier(0, 1, 0.5, 1)";
			elem.style.overflow = "hidden";
			checkElement();
			document.body.appendChild(elem);
			var action = document.getElementById("DearReaderAction");
			var close = document.getElementById("DearReaderClose");
			action.addEventListener("click", showPopup);
			close.addEventListener("click", clickHideAdvert);
		});
	};

	//Show message at appropriate time
	window.addEventListener("scroll", function() {
		checkElement();
	});

	var showing = false;
	var checkElement = function() {
		if (elem && !showing) {
			if (withinviewport(trackElem)) {
				elem.style.bottom = "0px";
				showing = true;
			} else {
				elem.style.bottom = "-60px";
			}
		}
	};

	var clickElement = function(e) {
		ajaxGet("click/" + message.id, function(err, result) {
			if (err) {
				console.error(err);
				return;
			}
			console.log(result);
		});
	};

	var clickHideAdvert = function(e) {
		e.preventDefault();
		sessionStorage.setItem("hideDRAd", true);
		hideAdvert();
	};

	var hideAdvert = function(e) {
		elem.style.display = "none";
	};

	var showAdvert = function(e) {
		elem.style.display = "block";
	};

	var closeModal = function() {
		document.body.removeChild(modal);
	};

	var showPopup = function() {
		ajaxGet("page/sales", function(err, result) {
			html = result.data;
			modal = document.createElement("div");
			modal.id = "DRModal";
			modal.innerHTML = "<div class='dr-modal-content'><div class='dr-modal-header'>" + message.message + " <span id='DRModalClose' class='close-button'>X</span></div><div class='dr-modal-body'>" + html + "</div></div>";
			hideAdvert();
			modal.addEventListener("click", function(e) {
				if (e.target === modal)
					closeModal();
			});
			
			document.body.appendChild(modal);
			var btnClose = document.getElementById("DRModalClose");
			btnClose.addEventListener("click", function(e) {
				closeModal();
				showAdvert();
			});
		});
		clickElement();
	};

	if (!sessionStorage.getItem("hideDRAd"))
		getMessage();
})();