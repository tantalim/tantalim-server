'use strict';

var winston = require('winston');

// silly: 0,
// debug: 1,
// verbose: 2,
// info: 3,
// warn: 4,
// error: 5

exports.main = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            level: 'warn', // And above
            // silent: true,
            colorize: true
        })
    ]
});

exports.debug = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            level: 'debug',
            colorize: true
        })
    ]
});

exports.sql = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            level: 'warn',
            colorize: true
        })
    ]
});

function sleep(ms) {
    console.warn('DEBUG: Sleeping for ' + ms + ' ms');
    var unixtime_ms = new Date().getTime();
    /*jshint noempty:false */
    while (new Date().getTime() < unixtime_ms + ms) {
    }
}
exports.sleep = sleep;
