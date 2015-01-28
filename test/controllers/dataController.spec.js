'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    BluebirdPromise = require('bluebird'),
    sinon = require('sinon');
//    async = require('async'),
//    should = require('should')

describe('Data Controller', function () {
    describe('save', function () {
        beforeEach(function () {
            this.mockResponse = {
                jsonp: sinon.spy()
            };

            var modelService = {
                getModelByName: function (modelName, callback) {
                    console.info('getModelByName');
                    switch (modelName) {
                        case 'EmptyModel':
                        case 'InvalidData':
                            callback({
                                modelName: modelName
                            }, null);
                            return;
                        default:
                            callback(null, new Error('Model not found'));
                    }
                }
            };

            var modelSaver = {
                save: function (modelDefinition, data) {
                    console.info('save');
//                    function () {
//                        switch (modelDefinition.modelName) {
//                            case 'InvalidData':
//                                throw new Error('Invalid data');
//                        }
//                        return data;
//                    }
                    return BluebirdPromise.resolve(data);
                }
            };

            this.controller = proxyquire(configAppRoot + 'controllers/dataController', {
                '../services/modelService': modelService,
                '../services/modelSaver': modelSaver
            });
        });

        function getJsonResponse(response) {
            return response.jsonp.args[0][0];
        }

        it('should error with bad model', function () {
            var res = this.mockResponse;
            var req = {
                pageName: 'ModelThatDoesNotExist'
            };
            this.controller.save(req, res, function () {
                var jsonResponse = getJsonResponse(res);
                var expectedError = 'Model not found';
                jsonResponse.error.should.equal(expectedError);
            });
        });
        it('should return empty data', function () {
            var res = this.mockResponse;
            var req = {
                pageName: 'EmptyModel',
                body: {EmptyModel: {insert: []}}
            };
            this.controller.save(req, res, function () {
                var jsonResponse = getJsonResponse(res.jsonp);
                return jsonResponse.data.should.eventually.eql({});
            });
        });

        it('should fail to save data', function () {
            var res = this.mockResponse;
            var req = {
                pageName: 'InvalidData',
                body: {InvalidData: {insert: []}}
            };
            this.controller.save(req, res, function () {
                var jsonResponse = getJsonResponse(res);
                return jsonResponse.should.eql({error: 'Invalid data', method: 'saver.save'});
            });
        });
    });
})
;
