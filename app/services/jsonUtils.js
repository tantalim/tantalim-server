'use strict';

function error(code, message) {
    return {
        code: code,
        message: message
    };
}

exports.error = error;
