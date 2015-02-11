'use strict';

var modelService = require('../services/pageService'),
    reader = require('../services/dataReader'),
    saver = require('../services/modelSaver'),
    logger = require('../logger/default').main;

function convertErrorToJson(err) {
    if (typeof err === 'string') {
        logger.warn('Try throwing an error instead for message: ' + err);
        return {
            code: 'Error',
            message: err
        };
    }
    return {
        code: err.name,
        stacktrace: err.stacktrace,
        message: err.message
    };
}

function errorFullResponse(res, err) {
    return res.jsonp({error: convertErrorToJson(err)});
}

exports.query = function (req, res, callback) {
    callback = callback || function () {
    };
    logger.debug('starting data.query()');
    return modelService.getDefinition(modelService.ARTIFACT.MODEL, req.pageName)
        .then(function (modelDefinition) {
            return reader.getData(modelDefinition, req.query.filterString, req.query.pageNumber);
        })
        .then(function (data) {
            res.jsonp(data);
            logger.debug('completed data.query()');
            callback();
        })
        .catch(function (err) {
            logger.debug('got an error in data.query()');
            errorFullResponse(res, err);
            callback();
        });
};

exports.save = function (req, res, callback) {
    callback = callback || function () {
    };
    logger.debug('starting dataController.save()');
    var dataToSave = req.body;
    if (!dataToSave) {
        errorFullResponse(res, Error('no data to save'));
        callback();
    }
    return modelService.getDefinition(modelService.ARTIFACT.MODEL, req.pageName)
        .then(function (modelDefinition) {
            logger.debug('got modelDefinition' + modelDefinition.name);
            return saver.save(modelDefinition, dataToSave);
        })
        .then(function (data) {
            res.jsonp(data);
            logger.debug('completed data.save()');
            callback();
        })
        .catch(function (err) {
            logger.debug('got an error in data.save()');
            errorFullResponse(res, err);
            callback();
        });
};
