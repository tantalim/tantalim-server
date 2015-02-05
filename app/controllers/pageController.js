'use strict';

var service = require('../services/pageService'),
    logger = require('../logger/default').main;

var app;

exports.setApp = function (_app) {
    app = _app;
};

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
        message: err.message
    };
}

/**
 * Lightweight Angular Wrapper that pulls in other resources for Desktop Applications
 */
exports.desktop = function (req, res) {
    if (!req.user) {
        res.redirect('/login');
        return;
    }

    res.render('desktop', {
        appTitle: app.locals.title,
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
    return service.getDefinition(service.ARTIFACT.PAGE, req.pageName)
        .then(function (content) {
            logger.info(content);
            return res.render('page/search', content);
        })
        .catch(function (err) {
            return res.render('page/htmlError', err);
        });
};

exports.htmlBody = function (req, res) {
    return service.getDefinition(service.ARTIFACT.PAGE, req.pageName)
        .then(function (content) {
            // TODO Support different types of page layouts: dashboard, traditional, report, html, chart
            //if (pageLocation.extension === 'html') {
            //    return res.sendfile(pageLocation.rawFilePath);
            //}

            logger.info(content);
            return res.render('page/htmlBody', content);
        })
        .catch(function (err) {
            return res.render('page/htmlError', convertErrorToJson(err));
        });
};

exports.mobileBody = function (req, res) {
    return service.getLocationByName(req.pageName)
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
    var scope = {};
    return service.getDefinition(service.ARTIFACT.PAGE, req.pageName)
        .then(function (pageDefinition) {
            scope.page = pageDefinition;
            return service.getDefinition(service.ARTIFACT.MODEL, pageDefinition.modelName);
        })
        .then(function (modelDefinition) {
            scope.model = modelDefinition;
            return res.render('page/pageDefinition.js', scope);
        })
        .catch(function (err) {
            return res.render('page/error.js', convertErrorToJson(err));
        });
};
