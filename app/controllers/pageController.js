'use strict';

var service = require('../services/pageService'),
    menuService = require('../services/menuService'),
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

    function renderDesktop(menu, page) {
        console.info(page);
        page.template = page.template || 'desktop';
        page.appTitle = page.appTitle || app.locals.title;
        page.css = page.css || app.locals.css;
        page.pageName = page.pageName || req.pageName;
        page.title = page.title || req.pageName;
        page.menu = page.menu || menu;
        page.user = req.user;

        page.page = {
            modelName: page.modelName
        };
        page.model = {};
        console.info(page);

        return res.render(page.template, page);
    }

    return menuService.buildMenuItems(req.user)
        .then(function (menu) {
            service.getDefinition(service.ARTIFACT.PAGE, req.pageName)
                .then(function (content) {
                    logger.info(content);
                    return renderDesktop(menu, content);
                    //return res.render('page/htmlBody', content);
                })
                .catch(function (err) {
                    return res.render('page/htmlError', convertErrorToJson(err));
                });
        })
        .catch(function (err) {
            var fakeMenu = {
                content: [{
                    title: 'Failed to build menu',
                    items: [{title: err}]
                }]
            };
            return renderDesktop(fakeMenu);
        });
};

/**
 * Lightweight Angular Wrapper that pulls in other resources for Mobile Applications
 */
exports.mobile = function (req, res) {
    if (!req.user) {
        res.redirect('/login');
        return;
    }

    var menu = {
        content: [
            {
                title: 'List Tables',
                page: 'ListTables'
            },
            {
                title: 'Build Table',
                page: 'BuildTable'
            }
        ]
    };

    // Get the real page title
    res.render('mobile', {
        appTitle: app.locals.title,
        css: app.locals.css,
        pageName: req.pageName,
        title: req.pageName,
        menu: menu,
        user: req.user
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

exports.mobileBody = function (req, res) {
    return service.getDefinition(service.ARTIFACT.PAGE, req.pageName)
        .then(function (content) {
            logger.info(content);
            return res.render('page/mobileBody', content);
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
