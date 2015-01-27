'use strict';

var async = require('async'),
    //_ = require('lodash'),
    Promise = require('bluebird'),
    fileUtils = require('./fileUtils'),
    jsonUtils = require('./jsonUtils'),
    //database = require('./db/modelDatabaseService'),
    logger = require('../logger/default').main;

function getLocationByName(pageName) {

    function getBestResult(results) {
        if (results) {
            logger.debug('getBestResult');
            logger.debug(results);
            var bestTantalimOption = results.tantalimDir[0] || null;
            var bestAppOption = results.appDir[0] || null;
            var bestDatabaseOption = results.databaseOptions[0] || null;

            return bestDatabaseOption || bestAppOption || bestTantalimOption;
        }
        return null;
    }

    //function convertDbToResults(data) {
    //    logger.debug('convertDbToResults');
    //    return _.map(data, function (db) {
    //        return _.defaults(db, {
    //                storageType: 'DATABASE'
    //            }
    //        );
    //    });
    //}

    return new Promise(function (resolve, reject) {
        async.parallel({
            tantalimDir: function (done) {
                var rootDir = './tantalim_modules';
                fileUtils.getListByTypeAndName(rootDir, 'models', pageName).then(function (data) {
                    done(null, data);
                }, function (err) {
                    logger.error('tantalimDir');
                    done(jsonUtils.error('fileOptions-Reject', err), null);
                });
            },
            appDir: function (done) {
                var rootDir = './app_modules';
                fileUtils.getListByTypeAndName(rootDir, 'models', pageName).then(function (data) {
                    done(null, data);
                }, function (err) {
                    logger.error('appDir');
                    done(jsonUtils.error('fileOptions-Reject', err), null);
                });
            },
            databaseOptions: function (done) {
                done(null, []);
//                database.getModelLocation(pageName)
//                    .then(function (data) {
//                        done(null, convertDbToResults(data));
//                    }, function (err) {
//                        logger.error('databaseOptions');
//                        done(err, null);
//                    });
            }
        }, function (err, results) {
            if (err) {
                return reject(err);
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
