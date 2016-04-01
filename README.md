# Dear Reader

Dear Reader is a platform to build a membership base of supporters for small, indie media houses. 

It is currently under development.

### Requirements

NodeJS
MongoDB
Gulp

### Config

```cp config-example.js config.js```

Change the port, url, username and password to suite.

### Building Assets

Install dependencies

```npm install```

Build the assets

```gulp```

### Running

```node server.js```

### Accessing

This should go in your HTML, at the point of scrolling where you want the popup to appear:

```<div id="DearReader" class="dearreader"></div>```

Then, somewhere near the bottom:

```<script src="http://5.9.195.7:8080/public/js/dearreader.min.js"></script>```

See the testpage.html for an example.