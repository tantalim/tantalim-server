'use strict';
/*jshint expr: true*/

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    sinon = require('sinon'),
    BluebirdPromise = require('bluebird'),
    pageService = {},
    modelService = {},
    chai = require('chai');

chai.Should();
chai.use(require('chai-as-promised'));

describe('Page Controller', function () {

    describe('pageDefinition', function () {
        var controller, res,
            req = {
                pageName: 'TestPage'
            };

        beforeEach(function () {
            res = {
                render: sinon.spy(),
                sendfile: sinon.spy()
            };
            controller = proxyquire(configAppRoot + 'controllers/pageController', {
                '../services/pageService': pageService,
                '../services/modelService': modelService
            });
        });

        it('should render error page', function (done) {
            var err = 'something "correctly" went wrong';
            pageService.getDefinition = BluebirdPromise.method(function () {
                throw Error(err);
            });

            controller.pageDefinition(req, res).should.be.fulfilled.then(function () {
                res.render.calledWith('page/error.js', err).should.be.true;
            }).should.notify(done);
        });

        it('should render json page', function (done) {
            var pageDefinition = {
                modelName: 'TestModel'
            };
            var modelDefinition = {
                id: 'TestModel'
            };
            pageService.getDefinition = BluebirdPromise.method(function () {
                return pageDefinition;
            });
            modelService.getDefinition = BluebirdPromise.method(function () {
                return modelDefinition;
            });

            controller.pageDefinition(req, res)
                .should.be.fulfilled.then(function () {
                    res.render.calledWith('page/pageDefinition.js', {
                        page: pageDefinition,
                        model: modelDefinition
                    }).should.be.true;
                }).should.notify(done);
        });
    });
});
