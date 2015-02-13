'use strict';

var pageController = require('../controllers/pageController'),
    passport = require('passport');

function addUserPages(app) {
    app.get('/m/:pageName', function (req, res) {
        pageController.mobile(req, res, app.locals);
    });

    app.get('/m/', function (req, res) {
        req.pageName = 'Home'; // TODO get this 'Home' from the menu default
        pageController.mobile(req, res, app.locals);
    });

    app.get('/page/:pageName/:mode', function (req, res) {
        pageController.desktop(req, res, app.locals);
    });

    app.get('/page/:pageName', function (req, res) {
        pageController.desktop(req, res, app.locals);
    });

    app.get('/artifact/:artifactType/:artifactName', function (req, res) {
        pageController.artifactDefinition(req, res);
    });

    app.get('/', function (req, res) {
        req.pageName = 'Home'; // TODO get this 'Home' from the menu default
        pageController.desktop(req, res, app.locals);
    });
}

function addDataApi(app) {
    var dataController = require('../controllers/dataController');

    app.get('/data/:pageName', function (req, res) {
        dataController.query(req, res);
    });
    app.post('/data/:pageName', function (req, res) {
        dataController.save(req, res);
    });
}

function addFrontEndJavaScriptAndHtmlPartials(app) {
    app.get('/m/:pageName/detail', function (req, res) {
        pageController.mobileBody(req, res);
    });

    app.get('/m/:pageName/list', function (req, res) {
        pageController.mobileBody(req, res);
    });
}

function addSourceEtl(app) {
    var sourceEtlController = require('../controllers/sourceEtlController');

    app.get('/exportAll', function (req, res) {
        sourceEtlController.exportAll(req, res);
    });

    app.get('/importAll', function (req, res) {
        sourceEtlController.importAll(req, res);
    });
}

function addLogins(app) {
    app.get('/logout', function (req, res) {
        req.logout();
        res.redirect('/');
    });

    app.get('/login', function (req, res) {
        res.render('login', {
            appTitle: app.locals.title,
            strategies: app.locals.passportStrategies,
            error: req.flash('error'),
            error_description: req.flash('error_description')
        });
    });

    // TODO Adding these URLs for the strategies seems like it should belong in the custom app, but I'm not sure how to get them there and start up the app correctly.
    if (app.locals.passportStrategies.local) {
        app.post('/login',
            passport.authenticate('local', {
                successRedirect: '/',
                failureRedirect: '/login',
                failureFlash: true
            })
        );
    }
    if (app.locals.passportStrategies.github) {
        app.get('/auth/github', passport.authenticate('github'));

        app.get('/auth/github/callback',
            passport.authenticate('github', {
                successRedirect: '/',
                failureRedirect: '/login',
                failureFlash: true
            }),
            function (req, res) {
                res.redirect('/');
            });
    }
}

module.exports = function (app) {
    app.param('pageName', function (req, res, next, pageName) {
        req.pageName = pageName;
        next();
    });

    addLogins(app);
    addUserPages(app);
    addFrontEndJavaScriptAndHtmlPartials(app);
    addSourceEtl(app);
    addDataApi(app);
};