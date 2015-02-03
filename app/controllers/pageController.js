'use strict';

var service = require('../services/pageService'),
    modelService = require('../services/modelService'),
    logger = require('../logger/default').main;

/**
 * Lightweight Angular Wrapper that pulls in other resources for Desktop Applications
 */
exports.desktop = function (req, res) {
    if (!req.user) {
        res.redirect('/login');
        return;
    }

    res.render('desktop', {
        appName: 'Tantalim Example',
        pageName: req.pageName,
        title: req.pageName,
        user: req.user
    });
};

/**
 * Lightweight Angular Wrapper that pulls in other resources for Mobile Applications
 */
exports.mobile = function (req, res) {
    // Get the real page title
    res.render('mobile', {
        appName: 'Tantalim',
        pageName: req.pageName,
        title: req.pageName
    });
};

exports.searchBody = function (req, res) {
    service.getLocationByName(req.pageName)
        .then(function (pageLocation) {
            if (pageLocation.extension === 'html') {
                return res.sendfile(pageLocation.rawFilePath);
            }

            service.getDefinition(pageLocation)
                .then(function (content) {
                    logger.info(content);
                    return res.render('page/search', content);
                });
        }, function (err) {
            return res.render('page/htmlError', err);
        })
        .catch(function (err) {
            return res.render('page/htmlError', err);
        });
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
            return res.render('page/htmlError', err);
        })
        .catch(function (err) {
            return res.render('page/htmlError', err);
        });
};

exports.mobileBody = function (req, res) {
    service.getLocationByName(req.pageName)
        .then(function (pageLocation) {
            if (pageLocation.extension === 'html') {
                return res.sendfile(pageLocation.rawFilePath);
            }

            service.getDefinition(pageLocation)
                .then(function (content) {
                    logger.info(content);
                    return res.render('page/mobileBody', content);
                });
        }, function (err) {
            return res.render('page/mobileError', err);
        })
        .catch(function (err) {
            return res.render('page/mobileError', err);
        });
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
