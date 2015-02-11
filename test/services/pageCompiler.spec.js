'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    BluebirdPromise = require('bluebird'),
    pageService = {},
    chai = require('chai');

chai.Should();
chai.use(require('chai-as-promised'));

describe.only('Page Compiler', function () {
    var compiler, PersonModel;

    beforeEach(function () {
        compiler = proxyquire(configAppRoot + 'services/pageCompiler', {
            './pageService': pageService
        });
        PersonModel = {
            name: 'Person',
            fields: [
                {name: 'PersonID', required: true},
                {name: 'Name', required: true},
                {name: 'ParentID', required: true}
            ]
        };
    });

    pageService.getDefinition = function (artifactType, artifactName) {
        return new BluebirdPromise(function (resolve) {
            if (artifactName === PersonModel.name) {
                return resolve(PersonModel);
            } else {
                throw Error('artifactName should be Person but is ' + artifactName);
            }
        });
    };

    it('should default from name if model is missing', function () {
        return compiler.compile({name: 'Person'}).should.eventually.eql({
            name: 'Person',
            model: 'Person'
        });
    });

    it('should add field definition', function () {
        return compiler.compile({
            name: 'Person',
            model: 'Person',
            fields: [{
                name: 'PersonID'
            }]
        }).should.eventually.have.property('fields').eql([{
                name: 'PersonID',
                required: true
            }]);
    });
});
