'use strict';

var modelService = require('../services/modelService'),
    reader = require('../services/dataReader'),
    saver = require('../services/modelSaver'),
    logger = require('../logger/default').main;

function errorFullResponse(res, err) {
    logger.error('Handling errorResponse in dataController');
    logger.error(err);
    return res.jsonp({error: err.toString()});
}

function getModel(modelName, res, andThen) {
    logger.debug('starting data.query() for %s', modelName);

    function errorResponse(err) {
        return errorFullResponse(res, err);
    }

    function getModelDefinition(modelLocation) {
        modelService.getDefinition(modelLocation)
            .then(function (modelDefinition) {
                andThen(modelDefinition);
            }, errorResponse);
    }

    modelService.getLocationByName(modelName)
        .then(getModelDefinition, errorResponse);
}

exports.query = function (req, res, callback) {
    callback = callback || function() {
    };

    getModel(req.pageName, res, function (modelDefinition) {
        reader.getData(modelDefinition, req.params.query, function (data, err) {
            if (err) {
                return errorFullResponse(res, err);
            }
            res.jsonp(data);
        });
    });
};

exports.save = function (req, res, callback) {
    callback = callback || function() {
    };
    getModel(req.pageName, res, function (modelDefinition) {
        if (modelDefinition.data === undefined || modelDefinition.data.modelName === undefined) {
            var message = 'model modelName is undefined';
            return errorFullResponse(res, message);
        }
        var dataToSave = req.body;
        if (!dataToSave) {
            logger.error('no data to save');
            logger.debug(req.body);
            res.jsonp({error: 'no data to save'});
            return callback(res);
        }
        saver.save(modelDefinition, dataToSave)
            .then(function (data) {
                res.jsonp(data);
                logger.debug('completed data.save()');
            })
            .catch(function (err) {
                errorFullResponse(res, err);
            })
            .finally(function () {
                return callback(res);
            });
    });
};