'use strict';

var service = require('../services/pageService'),
    menuService = require('../services/menuService'),
    errors = require('../errors'),
    _ = require('lodash'),
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

/**
 * Lightweight Angular Wrapper that pulls in other resources for Desktop Applications
 */
exports.desktop = function (req, res, appLocals) {
    if (!req.user) {
        res.redirect('/login');
        return;
    }

    appLocals = appLocals || {};

    function renderDesktop(page, menu) {
        page.template = page.template || 'desktop';
        if (page.css || appLocals.css) {
            page.css = page.css || appLocals.css;
        }

        return res.render(page.template, {
            appTitle: menu.appTitle || appLocals.title,
            user: req.user,
            menu: menu,
            page: page
        });
    }

    function attachModelToPage(page, model) {
        page.model = model;
        if (page.children) {
            _.forEach(page.children, function(childPage) {
                if (childPage.model && model.children) {
                    var childModel = _.find(model.children, function(childModel) {
                        if (childModel.name === childPage.model) {
                            return childModel;
                        }
                    });
                    attachModelToPage(childPage, childModel);
                }
            });
        }
    }

    return menuService.buildMenuItems(req.user)
        .then(function (menu) {
            service.getDefinition(service.ARTIFACT.PAGE, req.pageName)
                .then(function (page) {
                    if (page.model) {
                        service.getDefinition(service.ARTIFACT.MODEL, page.model)
                            .then(function (model) {
                                attachModelToPage(page, model);
                                return renderDesktop(page, menu);
                            })
                            .catch(function (err) {
                                errors.addTrace(err, {
                                    method: 'desktop',
                                    filename: __filename
                                });
                                return res.render('error', {
                                    appTitle: menu.appTitle || appLocals.title,
                                    user: req.user,
                                    menu: menu,
                                    error: convertErrorToJson(err)
                                });
                            });
                    } else {
                        return renderDesktop(page, menu);
                    }
                })
                .catch(function (err) {
                    errors.addTrace(err, {
                        method: 'desktop',
                        filename: __filename
                    });
                    return res.render('error', {
                        appTitle: menu.appTitle || appLocals.title,
                        user: req.user,
                        menu: menu,
                        error: convertErrorToJson(err)
                    });
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
exports.mobile = function (req, res, appLocals) {
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
        appTitle: appLocals.title,
        css: appLocals.css,
        pageName: req.pageName,
        title: req.pageName,
        menu: menu,
        user: req.user
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
