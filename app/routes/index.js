'use strict';

var pageController = require('../controllers/pageController'),
    menuController = require('../controllers/menuController');

function addUserPages(app) {
    app.get('/m/:pageName', function (req, res) {
        pageController.mobile(req, res);
    });

//    app.get('/page/:pageName', function (req, res) {
//        res.redirect('/page/' + req.pageName + '/');
//    });

    app.get('/page/:pageName/', function (req, res) {
        pageController.desktop(req, res);
    });

    app.get('/m/', function (req, res) {
        req.pageName = 'Home';
        pageController.mobile(req, res);
    });

    app.get('/', function (req, res) {
        req.pageName = 'Home';
        pageController.desktop(req, res);
    });
}

function addDataApi(app) {
    var dataController = require('../controllers/dataController');
    app.get('/data/:pageName', function (req, res) {
        dataController.query(req, res);
    });

    app.get('/data/:pageName/q/:query', function (req, res) {
        dataController.query(req, res);
    });

    app.get('/data/:pageName/q/', function (req, res) {
        dataController.query(req, res);
    });

    app.post('/data/:pageName', function (req, res) {
        dataController.save(req, res);
    });
}

function addFrontEndJavaScriptAndHtmlPartials(app) {
    app.get('/page-definition/:pageName', function (req, res) {
        pageController.pageDefinition(req, res);
    });

    app.get('/page/:pageName/html', function (req, res) {
        pageController.htmlBody(req, res);
    });

    app.get('/page/:pageName/search', function (req, res) {
        pageController.searchBody(req, res);
    });

    app.get('/m/:pageName/detail', function (req, res) {
        pageController.mobileBody(req, res);
    });

    app.get('/m/:pageName/list', function (req, res) {
        pageController.mobileBody(req, res);
    });
}

module.exports = function (app) {
    app.param('pageName', function (req, res, next, pageName) {
        req.pageName = pageName;
        next();
    });

    app.get('/menu', function (req, res) {
        menuController.menu(req, res);
    });

    addUserPages(app);
    addFrontEndJavaScriptAndHtmlPartials(app);
    addDataApi(app);
};