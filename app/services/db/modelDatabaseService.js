'use strict';

var _ = require('lodash'),
    async = require('async'),
//    jsonUtils = require('../jsonUtils'),
    BluebirdPromise = require('bluebird'),
    logger = require('../../logger/default').main,
    sqlLogger = require('../../logger/default').sql,
    dao = require('./modelDao');

var validateCodeName = function (name) {
    var regex = '^[A-Za-z_][A-Za-z0-9_]+$';
    if (!name.match(regex)) {
        throw new Error('Names must start with a letter and have only letters, numbers, and underscores');
    }
};

/**
 * @param fullModelName
 * Examples of modelName
 * - ManageTable
 * - tantalim.ManageTable
 */
function toWhere(fullModelName) {
    if (!fullModelName) {
        throw new Error('Model name is required');
    }

    var appName = '',
        modelName = fullModelName;

    var names = modelName.split('.');
    if (names.length > 1) {
        modelName = names[1];
        appName = names[0];
    }

    validateCodeName(modelName);
    if (appName)
        validateCodeName(appName);

    return {
        model: modelName,
        application: appName
    };
}

function getModelLocation(modelName) {
    return new BluebirdPromise(function (resolve, reject) {
        var names = toWhere(modelName);
        var modelByNameSql = dao.getModelByNameSql(names.model, names.application);
        sqlLogger.verbose(modelByNameSql.toSql());
        sqlLogger.debug(modelByNameSql.getBindings());

        function processDataResponse(data) {
            if (!data || data.length === 0) {
//                logger.warn('failed to find model: %s', names.model);
//                reject(jsonUtils.error('MODEL_NOT_FOUND', 'modelService.getModelByName failed to find model ' + names.model));
                resolve([]);
                return;
            }
            logger.debug('found data for model');
            logger.debug(data);

            var model = {};
            model.data = data[0];

            // TODO should we return model instead??
            resolve(data);
        }

        modelByNameSql.then(processDataResponse, reject);
    });
}

function getModelByName(modelName) {
    return new BluebirdPromise(function (resolveGetModelByName, rejectGetModelByName) {
        logger.debug('starting modelService.getModelByName for ', modelName);
        var names = toWhere(modelName);

        logger.debug('searching for model with DAO', modelName);
        var modelByNameSql = dao.getModelByNameSql(names.model, names.application);
        sqlLogger.verbose(modelByNameSql.toSql());
        sqlLogger.debug(modelByNameSql.getBindings());
        modelByNameSql
            .then(function (data) {
                if (!data || data.length === 0) {
                    logger.warn('failed to find model: %s', names);
                    throw new Error('modelService.getModelByName failed to find model');
                }

                var model = {};
                model.data = data[0];

                async.parallel({
                    fields: function (done) {
                        dao.getFieldsByModelID(model.data.modelID).then(function (data) {
                            done(null, data);
                        }, function (err) {
                            done(err, null);
                        });
                    },
                    steps: function (done) {
                        dao.getStepsByModelID(model.data.modelID).then(function (data) {
                            done(null, data);
                        }, function (err) {
                            done(err, null);
                        });
                    },
                    children: function (done) {
                        dao.getChildJoinsByModelID(model.data.modelID).then(function (data) {
                            done(null, data);
                        }, function (err) {
                            done(err, null);
                        });
                    }
                }, function (err, results) {
                    if (err) {
                        logger.error(err);
                        throw new Error(err);
                    }
                    _.merge(model, results);
                    return resolveGetModelByName(model);
                });
            })
            .catch(function (err) {
                return rejectGetModelByName(err);
            });
    });
}

exports.toWhere = toWhere;
exports.getModelByName = getModelByName;
exports.getModelLocation = getModelLocation;
