'use strict';

var dao = require('./pageDao'),
    Promise = require('bluebird');

function getPage(name) {
    return new Promise(function (resolve, reject) {
        var sql = dao.getPageSql(name);
        sql.then(function (result) {
            resolve(result);
        }, reject);
    });
}

exports.getPage = getPage;