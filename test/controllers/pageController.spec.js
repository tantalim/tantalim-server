'use strict';
/*jshint expr: true*/

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    sinon = require('sinon'),
    Promise = require('bluebird'),
    pageService = {},
    modelService = {},
    chai = require('chai');

chai.Should();
chai.use(require('chai-as-promised'));

describe('Page Controller', function () {

    describe('promises', function () {
        function testPromise(id) {
            return new Promise(function (resolve, reject) {
                console.info('test ' + id);
                if (id > 3) {
                    reject('higher than 2');
                }
                resolve(id + 1);
            });
        }

        function pageDefinition() {
            function handleReject(reason) {
                console.warn('failure ' + reason);
            }

            var id = 0;
            return testPromise(id)
                .then(function (id) {
                    return testPromise(id)
                        .then(function (id) {
                            return id;
                        }, handleReject);
                }, handleReject);
        }

        it('should run Promises', function (done) {

            pageDefinition()
                .should.be.fulfilled.then(function (foo) {
                    foo.should.equal(2);
                })
                .should.notify(done);
        });
    });

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

        it('should send raw file', function (done) {
            var rawFilePath = './raw/file';
            pageService.getLocationByName = Promise.method(function () {
                return {
                    extension: 'js',
                    rawFilePath: rawFilePath
                };
            });

            controller.pageDefinition(req, res).should.be.fulfilled.then(function () {
                res.sendfile.calledWith(rawFilePath).should.be.true;
            }).should.notify(done);
        });

        it('should render error page', function (done) {
            var err = 'something "correctly" went wrong';
            pageService.getLocationByName = function () {
                return new Promise(function (resolve, reject) {
                    reject(err);
                });
            };

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
            pageService.getLocationByName = Promise.method(function () {
                return {
                    extension: 'json'
                };
            });
            pageService.getDefinition = Promise.method(function () {
                return pageDefinition;
            });
            modelService.getLocationByName = Promise.method(function () {
                return {
                    extension: 'json'
                };
            });
            modelService.getDefinition = Promise.method(function () {
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
