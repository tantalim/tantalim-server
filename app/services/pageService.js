'use strict';

var fileUtils = require('./fileUtils'),
    pageDS = require('./db/pageDatabaseService'),
    jsonUtils = require('./jsonUtils'),
    logger = require('../logger/default').main,
//    _ = require('lodash'),
    async = require('async'),
    BluebirdPromise = require('bluebird');

//function endsWith(str, suffix) {
//    if (!str) {
//        return false;
//    }
//    return str.indexOf(suffix, str.length - suffix.length) !== -1;
//}

function getLocationByName(pageName) {

    logger.info('starting getLocationByName for %s', pageName);

    function getBestResult(results) {
        var bestTantalimOption = results.tantalimDir[0] || null;
        var bestAppOption = results.appDir[0] || null;
        var bestDatabaseOption = results.databaseOptions[0] || null;

        return bestDatabaseOption || bestAppOption || bestTantalimOption;
    }

//    function convertDbToResults(data) {
//        return _.map(data, function (db) {
//            return _.defaults(db, {
//                    storageType: 'DATABASE'
//                }
//            );
//        });
//    }

    return new BluebirdPromise(function (resolve, reject) {
        async.parallel({
            tantalimDir: function (done) {
                var rootDir = './tantalim_modules';
                fileUtils.getListByTypeAndName(rootDir, 'pages', pageName).then(function (data) {
                    done(null, data);
                }, function (err) {
                    done(jsonUtils.error('fileOptions-Reject', err), null);
                });
            },
            appDir: function (done) {
                var rootDir = './app_modules';
                fileUtils.getListByTypeAndName(rootDir, 'pages', pageName).then(function (data) {
                    done(null, data);
                }, function (err) {
                    done(jsonUtils.error('fileOptions-Reject', err), null);
                });
            },
            databaseOptions: function (done) {
                done(null, []);
                // TODO finish getting pages from the database
                logger.info('starting databaseOptions');
                logger.info(pageDS);
    //                pageDS.getPage(pageName)
//                    .then(function (data) {
//                        done(null, convertDbToResults(data));
//                    }, function (err) {
//                        done(jsonUtils.error('getPageSql-Reject', err), null);
//                    })
//                    .catch(function (err) {
//                        logger.info('getPageSql-Catch');
//                        done(jsonUtils.error('getPageSql-Catch', err), null);
//                    });
            }
        }, function (err, results) {
            if (err) {
                logger.error('failed');
                logger.error(err);
                return reject(err);
            }
            logger.info(results);

            var bestOption = getBestResult(results);
            if (!bestOption) {
                logger.info('no options found');
                return reject(jsonUtils.error('PAGE_NOT_FOUND', 'Page does not exist for ' + pageName));
            }
            resolve(bestOption);
        });
    });
}

function getDefinition(pageLocation) {
    return new BluebirdPromise(function (resolve, reject) {
        logger.info('getPageDefinition');
        logger.info(pageLocation);

        if (pageLocation.extension === 'json') {
            fileUtils.getJsonFromFile(pageLocation)
                .then(function (content) {
                    resolve(content);
                });
        } else {
            return reject(jsonUtils.error('PAGE_NOT_FOUND', 'Page extension JSON is the only supported type. ' + pageLocation.name));
        }
    });
}

function getSearchByName(pageName, callback) {
    // TODO convert this to bluebird
    try {
        var page = require('../temp/search_' + pageName);
        callback(page.page, null);
        return;
    } catch (e) {
    }
    callback(null, new jsonUtils.error('Could not find UI for ' + pageName));
}

exports.getLocationByName = getLocationByName;
exports.getDefinition = getDefinition;
exports.getSearchByName = getSearchByName;
