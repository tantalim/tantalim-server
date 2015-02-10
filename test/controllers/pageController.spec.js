'use strict';
/*jshint expr: true*/

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    sinon = require('sinon'),
    BluebirdPromise = require('bluebird'),
    pageService = {},
    menuService = {},
    chai = require('chai');

chai.should();
chai.use(require('chai-as-promised'));

describe('Page Controller', function () {
    var controller, res,
        user = {id: 'johndoe'},
        req = {
            pageName: 'TestPage',
            user: user
        };

    beforeEach(function () {
        menuService.buildMenuItems = BluebirdPromise.method(function () {
            return {};
        });
        res = {
            render: sinon.spy(),
            redirect: sinon.spy(),
            sendfile: sinon.spy()
        };
        controller = proxyquire(configAppRoot + 'controllers/pageController', {
            '../services/pageService': pageService,
            '../services/menuService': menuService
        });
    });

    it('should redirect if not logged in', function () {
        delete req.user;
        controller.desktop(req, res);
        res.redirect.calledWith('/login').should.be.true;
    });

    it('should render error page', function (done) {
        var err = 'something "correctly" went wrong';
        pageService.getDefinition = BluebirdPromise.method(function () {
            throw Error(err);
        });

        controller.desktop(req, res, {title: 'Test App'}).should.be.fulfilled.then(function () {
            res.render.getCall(0).args[1].should.eql({
                appTitle: 'Test App',
                user: user,
                menu: {},
                error: {
                    stacktrace: [{
                        filename: 'app/controllers/pageController.js',
                        method: 'desktop'
                    }],
                    code: 'Error',
                    message: 'something "correctly" went wrong'
                }
            });
        }).should.notify(done);
    });

    it('should render json page', function (done) {
        var modelDefinition = {
            name: 'TestModel'
        };
        var pageDefinition = {
            model: 'TestModel'
        };
        pageService.getDefinition = BluebirdPromise.method(function (artifact_type) {
            if (artifact_type === 'page')
                return pageDefinition;
            else
                return modelDefinition;
        });

        controller.desktop(req, res, {title: 'Test App'})
            .should.be.fulfilled.then(function () {
                var args = res.render.getCall(0).args;
                args[0].should.equal('desktop');
                args[1].should.eql({
                    appTitle: 'Test App',
                    user: user,
                    menu: {},
                    page: {
                        template: 'desktop',
                        model: modelDefinition
                    }
                });
            }).should.notify(done);
    });
});
