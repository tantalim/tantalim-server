'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    BluebirdPromise = require('bluebird'),
    sinon = require('sinon'),
    chai = require('chai');

chai.Should();
chai.use(require('chai-as-promised'));

describe('Data Controller', function () {
    var res;

    beforeEach(function () {
        res = {
            jsonp: sinon.spy()
        };
    });

    function getJsonResponse(response) {
        return response.jsonp.args[0][0];
    }

    var pageService = {
        getDefinition: function (artifactType, artifactName) {
            return new BluebirdPromise(function (resolve, reject) {
                switch (artifactName) {
                    case 'ModelEmptyModel':
                    case 'InvalidData':
                        resolve({
                            name: artifactName
                        });
                        return;
                    default:
                        reject(new Error('Model not found'));
                }
            });
        }
    };

    describe('save', function () {
        beforeEach(function () {

            var modelSaver = {
                save: function (modelDefinition, data) {
                    console.info('save');
                    return BluebirdPromise.resolve(data);
                }
            };

            this.controller = proxyquire(configAppRoot + 'controllers/dataController', {
                '../services/pageService': pageService,
                '../services/modelSaver': modelSaver
            });
        });

        it('should error no data to save', function () {
            var req = {};
            return this.controller.save(req, res, function () {
                getJsonResponse(res).error.message.should.equal('no data to save');
            });
        });
        it('should error with bad model', function () {
            var req = {
                pageName: 'ModelThatDoesNotExist',
                body: 'stuff to save'
            };
            return this.controller.save(req, res, function () {
                getJsonResponse(res).error.message.should.equal('Model not found');
            });
        });
        it.skip('should return empty data', function () {
            var req = {
                pageName: 'EmptyModel',
                body: {EmptyModel: {insert: []}}
            };
            return this.controller.save(req, res, function () {
                getJsonResponse(res).data.should.eql({});
            });
        });

        it.skip('should fail to save data', function () {
            var req = {
                pageName: 'InvalidData',
                body: {InvalidData: {insert: []}}
            };
            return this.controller.save(req, res, function () {
                getJsonResponse(res).error.message.should.equal('Invalid data');
            });
        });
    });

    describe('query', function () {
        var reader = {
            save: function (modelDefinition, data) {
                console.info('save');
                return BluebirdPromise.resolve(data);
            }
        };

        beforeEach(function () {
            this.controller = proxyquire(configAppRoot + 'controllers/dataController', {
                '../services/pageService': pageService,
                '../services/dataReader': reader
            });
        });

        it.skip('should fail to read data', function () {
            var req = {
                pageName: 'InvalidData',
                query: {}
            };
            return this.controller.query(req, res, function () {
                var jsonResponse = getJsonResponse(res);
                return jsonResponse.should.eql({error: {
                    code: 'Error',
                    message: 'Error'
                }});
            });
        });

    });
});
