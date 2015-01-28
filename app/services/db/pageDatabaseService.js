'use strict';

var dao = require('./pageDao'),
    BluebirdPromise = require('bluebird');

function getPage(name) {
    return new BluebirdPromise(function (resolve, reject) {
        var sql = dao.getPageSql(name);
        sql.then(function (result) {
            resolve(result);
        }, reject);
    });
}

exports.getPage = getPage;