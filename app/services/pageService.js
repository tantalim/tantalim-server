'use strict';

var fileUtils = require('./fileUtils'),
    pageDS = require('./db/pageDatabaseService'),
    jsonUtils = require('./jsonUtils'),
    logger = require('../logger/default').main,
    _ = require('lodash'),
    async = require('async'),
    Promise = require('bluebird');

//function endsWith(str, suffix) {
//    if (!str) {
//        return false;
//    }
//    return str.indexOf(suffix, str.length - suffix.length) !== -1;
//}

function getLocationByName(pageName) {

    logger.info('starting getLocationByName');

    function getBestResult(results) {
        var bestFileOption = results.fileOptions[0] || null;
        var bestDatabaseOption = results.databaseOptions[0] || null;

        return bestDatabaseOption || bestFileOption;
    }

//    function convertResults(bestOption) {
//
//        if (bestOption.storageType === 'FILE') {
//            if (endsWith(bestOption.name, '.html')) {
//                return {
//                    rawFilePath: fileUtils.convertLocationObjectToPath(bestOption)
//                };
//            } else if (endsWith(bestOption.name, '.json')) {
//                return {
//                    jsonFile: bestOption
//                };
//            } else {
//                throw new Error('Found invalid page type ' + bestOption.name);
//            }
//        } else {
//            // READ Page from DB
//            var pageJson = {
//
//            };
//
//            return {
//                content: {
//                    page: pageJson,
//                    model: {}
//                }
//            };
//        }
//    }

    function convertDbToResults(data) {
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
                fileUtils.getListByTypeAndName('pages', pageName).then(function (data) {
                    done(null, data);
                }, function (err) {
                    done(jsonUtils.error('fileOptions-Reject', err), null);
                });
            },
            databaseOptions: function (done) {
                logger.info('databaseOptions');
                pageDS.getPage(pageName)
                    .then(function (data) {
                        done(null, convertDbToResults(data));
                    }, function (err) {
                        done(jsonUtils.error('getPageSql-Reject', err), null);
                    })
                    .catch(function (err) {
                        logger.info('getPageSql-Catch');
                        done(jsonUtils.error('getPageSql-Catch', err), null);
                    });
            }
        }, function (err, results) {
            if (err) {
                logger.error('failed');
                reject(err);
            }
            logger.info(results);

            var bestOption = getBestResult(results);
            if (!bestOption) {
                return reject(jsonUtils.error('PAGE_NOT_FOUND', 'Page does not exist for ' + pageName));
            }
            resolve(bestOption);
        });
    });
}

function getDefinition(pageLocation) {
    return new Promise(function (resolve, reject) {
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
