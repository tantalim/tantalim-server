'use strict';

var _ = require('lodash'),
    async = require('async'),
    Promise = require('bluebird'),
    fileUtils = require('./fileUtils'),
    jsonUtils = require('./jsonUtils'),
    logger = require('../logger/default').main,
    database = require('./db/modelDatabaseService');

function getLocationByName(pageName) {

    function getBestResult(results) {
        if (results) {
            logger.debug('getBestResult');
            logger.debug(results);
            if (results.databaseOptions && results.databaseOptions[0]) {
                return results.databaseOptions[0];
            }
            if (results.fileOptions && results.fileOptions[0]) {
                return results.fileOptions[0];
            }
        }
        return null;
    }

    function convertDbToResults(data) {
        logger.debug('convertDbToResults');
        return _.map(data, function (db) {
            return _.defaults(db, {
                    storageType: 'DATABASE'
                }
            );
        });
    }

    return new Promise(function (resolve, reject) {
        async.parallel({
            fileOptions: function (done) {
                fileUtils.getListByTypeAndName('models', pageName).then(function (data) {
                    done(null, data);
                }, function (err) {
                    done(jsonUtils.error('fileOptions-Reject', err), null);
                });
            },
            databaseOptions: function (done) {
                database.getModelLocation(pageName)
                    .then(function (data) {
                        done(null, convertDbToResults(data));
                    }, function (err) {
                        done(err, null);
                    });
            }
        }, function (err, results) {
            if (err) {
                reject(err);
            }

            var bestOption = getBestResult(results);
            if (!bestOption) {
                return reject(jsonUtils.error('MODEL_NOT_FOUND', 'Model does not exist for ' + pageName));
            }
            resolve(bestOption);
        });
    });
}

function getDefinition(location) {
    return new Promise(function (resolve, reject) {
        if (location.extension === 'json') {
            fileUtils.getJsonFromFile(location)
                .then(function (content) {
                    resolve(content);
                });
        } else {
            return reject(jsonUtils.error('PAGE_NOT_FOUND', 'Page extension JSON is the only supported type. ' + location.name));
        }
    });
}

exports.getDefinition = getDefinition;
exports.getLocationByName = getLocationByName;
