'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    BluebirdPromise = require('bluebird'),
    pageService = {},
    chai = require('chai');

chai.Should();
chai.use(require('chai-as-promised'));

describe('Page Compiler', function () {
    var compiler, PersonModel;

    beforeEach(function () {
        compiler = proxyquire(configAppRoot + 'services/pageCompiler', {
            './pageService': pageService
        });
        PersonModel = {
            name: 'Person',
            fields: [
                {name: 'PersonID', required: true},
                {name: 'Name'}
            ],
            children: [{
                name: 'Child',
                fields: [
                    {name: 'ChildID'},
                    {name: 'ChildName'}
                ]
            }]
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
        return compiler.compile({
            name: 'Person'
        }).should.eventually.eql({
                name: 'Person',
                model: 'Person',
                viewMode: 'form',
                hasBothViews: false,
                hasFormView: false,
                hasTableView: false,
                hasNavigation: false
            });
    });

    it('should error if field is missing', function () {
        return compiler.compile({
            name: 'Person',
            fields: [{
                name: 'FieldNotInModel'
            }]
        }).should.eventually.be.rejectedWith(Error, 'Could not find field in model for Person.FieldNotInModel');
    });

    it('should add field definition', function () {
        return compiler.compile({
            name: 'Person',
            fields: [{
                name: 'PersonID'
            }]
        }).should.eventually.have.property('fields').eql([{
                name: 'PersonID',
                fieldName: 'PersonID',
                label: 'PersonID',
                required: true,
                showInNavigation: false,
                showInFormView: true,
                showInTableView: true,
                searchable: true
            }]);
    });

    it('should add child definition', function () {
        return compiler.compile({
            name: 'Person',
            fields: [{
                name: 'PersonID'
            }],
            children: [{
                name: 'Child',
                fields: [{
                    name: 'ChildID'
                }]
            }]
        }).should.eventually.have.property('children').eql([{
                name: 'Child',
                model: 'Child',
                viewMode: 'form',
                hasBothViews: true,
                hasFormView: true,
                hasTableView: true,
                hasNavigation: false,
                fields: [{
                    name: 'ChildID',
                    fieldName: 'ChildID',
                    label: 'ChildID',
                    showInNavigation: false,
                    showInFormView: true,
                    showInTableView: true,
                    searchable: true
                }]
            }]);
    });
});
