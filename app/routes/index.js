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

    app.get('/page/:pageName/', function (req, res) {
        pageController.desktop(req, res, app.locals);
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

function addLogins(app) {
    app.get('/logout', function (req, res) {
        req.logout();
        res.redirect('/');
    });

    app.get('/login', function (req, res) {
        res.render('login', {
            appTitle: app.locals.title,
            message: req.flash('error')
        });
    });

    app.post('/login',
        passport.authenticate('local', {
            successRedirect: '/',
            failureRedirect: '/login',
            failureFlash: true
        })
    );
}

module.exports = function (app) {
    app.param('pageName', function (req, res, next, pageName) {
        req.pageName = pageName;
        next();
    });

    addLogins(app);
    addUserPages(app);
    addFrontEndJavaScriptAndHtmlPartials(app);
    addDataApi(app);
};