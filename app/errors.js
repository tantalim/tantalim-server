'use strict';

var currentDir = __dirname;

/**
 *
 * @param err = Error exception
 * @param current = {
 * filename
 * method
 * line
 * description
 * reason
 * }
 */
exports.addTrace = function (err, current) {
    if (!err.stacktrace) {
        err.stacktrace = [];
    }

    if (current.filename) {
        current.filename = current.filename.replace(currentDir, 'app');
    }

    err.stacktrace.push(current);
};
