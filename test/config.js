'use strict';

var config = {
    appRoot: '../../'
};
module.exports = config;

var app = require(config.appRoot + 'main');
module.exports.app = app;
