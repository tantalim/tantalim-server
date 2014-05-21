'use strict';

// TODO this whole page is still a mess. Need more unit tests.

var service = require('../services/pageService'),
    modelService = require('../services/modelService'),
    logger = require('../logger/default').main;

/**
 * Lightweight Angular Wrapper that pulls in other resources for Desktop Applications
 */
exports.desktop = function (req, res) {
    res.render('desktop', {
        pageName: req.pageName,
        title: req.pageName
    });
};

/**
 * Lightweight Angular Wrapper that pulls in other resources for Mobile Applications
 */
exports.mobile = function (req, res) {
    // Get the real page title
    res.render('mobile', {
        pageName: req.pageName,
        title: req.pageName
    });
};

exports.searchBody = function (req, res) {
    function returnHttpResponse(pageResult) {
        if (pageResult.error) {
            res.render('page/error.html', pageResult.content);
        } else if (pageResult.rawFilePath) {
            res.sendfile(pageResult.rawFilePath);
        } else {
            res.render('page/search', pageResult.content);
        }
    }

    return service.getPageByName(req.pageName).then(returnHttpResponse);
};

exports.htmlBody = function (req, res) {
    service.getLocationByName(req.pageName)
        .then(function (pageLocation) {
            if (pageLocation.extension === 'html') {
                return res.sendfile(pageLocation.rawFilePath);
            }

            service.getDefinition(pageLocation)
                .then(function (content) {
                    logger.info(content);
                    return res.render('page/htmlBody', content);
                });
        }, function (err) {
            return res.render('page/error', err);
        })
        .catch(function (err) {
            return res.render('page/error', err);
        });
};

exports.mobileBody = function (req, res) {
    function returnHttpResponse(pageResult) {
        if (pageResult.error) {
            res.render('page/error.html', pageResult.content);
        } else if (pageResult.rawFilePath) {
            res.sendfile(pageResult.rawFilePath);
        } else {
            res.render('page/mobile_list', pageResult.content);
        }
    }

    return service.getPageByName(req.pageName).then(returnHttpResponse);
};

/**
 * Returns JSON Object containing page and model definitions
 */
exports.pageDefinition = function (req, res) {
    var errorResponse = function (err) {
        logger.error('Handling errorResponse in pageController');
        logger.error(err);
        return res.render('page/error.js', err);
    };

    logger.info('pageService.getLocationByName with ' + req.pageName);
    return service.getLocationByName(req.pageName)
        .then(function (pageLocation) {
            if (pageLocation.extension === 'js') {
                return res.sendfile(pageLocation.rawFilePath);
            }

            return service.getDefinition(pageLocation)
                .then(function (pageDefinition) {
                    return modelService.getLocationByName(pageDefinition.modelName)
                        .then(function (modelLocation) {
                            return modelService.getDefinition(modelLocation)
                                .then(function (modelDefinition) {
                                    return res.render('page/pageDefinition.js', {
                                        page: pageDefinition,
                                        model: modelDefinition
                                    });
                                }, errorResponse);
                        }, errorResponse);
                }, errorResponse);
        }, errorResponse);
};
