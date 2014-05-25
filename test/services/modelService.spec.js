'use strict';

var config = require('../config');
var service = require('../' + config.appRoot + 'app/services/modelService');
var should = require('should');

// TODO Get this to pass tests
describe.skip('Model Service', function () {
    describe('toWhere', function () {
        it('should require a model name', function () {
            should(function () {
                service.toWhere();
            }).throw('Model name is required');
            should(function () {
                service.toWhere('');
            }).throw('Model name is required');
        });

        it('should parse SQL for valid name', function () {
            var names = service.toWhere('ModelName');
            names.model.should.equal('ModelName');
        });

        it('should parse SQL for valid name with app', function () {
            var names = service.toWhere('application.ModelName');
            names.model.should.equal('ModelName');
            names.application.should.equal('application');
        });

        it('should require a valid model name', function () {
            should(function () {
                service.toWhere('This\'s a bad model name');
            }).throw();
        });
    });

    describe('getModelByName', function () {
        it('should not find the model', function () {
            return service.getModelByName('ModelThatDoesNotExist').should.eventually.be.rejected;
        });
    });
});
