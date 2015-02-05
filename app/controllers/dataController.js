'use strict';

var modelService = require('../services/pageService'),
    reader = require('../services/dataReader'),
    saver = require('../services/modelSaver'),
    logger = require('../logger/default').main;

function errorFullResponse(res, err) {
    logger.info('Handling errorResponse in dataController');
    logger.info(JSON.stringify(err));
    return res.jsonp({error: err.toString()});
}

exports.query = function (req, res) {
    logger.debug('starting data.query()');
    return modelService.getDefinition(modelService.ARTIFACT.MODEL, req.pageName)
        .then(function (modelDefinition) {
            return reader.getData(modelDefinition, req.query.filterString, req.query.pageNumber);
        })
        .then(function (data) {
            res.jsonp(data);
        })
        .catch(function (err) {
            return errorFullResponse(res, err);
        });
};

exports.save = function (req, res, callback) {
    callback = callback || function () {
    };
    return modelService.getDefinition(modelService.ARTIFACT.MODEL, req.pageName)
        .then(function (modelDefinition) {
            var dataToSave = req.body;
            if (!dataToSave) {
                logger.error('no data to save');
                logger.debug(req.body);
                res.jsonp({error: 'no data to save'});
                return callback(res);
            }
            return saver.save(modelDefinition, dataToSave);
        })
        .then(function (data) {
            res.jsonp(data);
            logger.debug('completed data.save()');
        })
        .catch(function (err) {
            errorFullResponse(res, err);
        });
};