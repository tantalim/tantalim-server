'use strict';

var express = require('express');

var app = express();

app.get('/', function (req, res) {
    res.send('Hello World');
});

var start = function () {
    var server = app.listen(3000, function () {
        console.log('Tantalim Server running on port %d', server.address().port);
    });
};

exports.start = start;
exports.app = app;
