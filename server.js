'use strict';

var express = require('express');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var app = express();

app.get('/', function (req, res) {
    res.send('Hello World');
});

var addClientFiles = function (clientDirectory) {
    app.use(express.static(clientDirectory));
};

var start = function () {
    var server = app.listen(3000, function () {
        console.log('Tantalim Server running on port %d', server.address().port);
    });
};

exports.addClientFiles = addClientFiles;
exports.start = start;
exports.app = app;
