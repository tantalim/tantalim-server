'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    BluebirdPromise = require('bluebird'),
    pageService = {},
    chai = require('chai');

chai.Should();
chai.use(require('chai-as-promised'));

describe.only('Model Compiler', function () {
    var compiler;

    beforeEach(function () {
        compiler = proxyquire(configAppRoot + 'services/modelCompiler', {
            './pageService': pageService
        });
    });

    var PersonTable = {
        name: 'Person',
        dbName: 'person',
        columns: [
            {name: 'PersonID'},
            {name: 'Name'},
            {name: 'ParentID'}
        ],
        joins: [{
            name: 'Parent',
            table: 'Person',
            columns: [{
                from: 'ParentID',
                to: 'PersonID'
            }]
        }]
    };
    pageService.getDefinition = function (artifactType, artifactName) {
        return new BluebirdPromise(function (resolve) {
            if (artifactName === PersonTable.name) {
                return resolve(PersonTable);
            } else {
                throw Error('artifactName should be Person but is ' + artifactName);
            }
        });
    };

    it('should error if basisTable is missing', function () {
        return compiler.compile({}).should.be.rejectedWith(Error, 'basisTable is required');
    });
    it('should compile simple', function () {
        return compiler.compile({
            basisTable: 'Person'
        }).should.eventually.eql({
                basisTable: {
                    name: 'Person',
                    dbName: 'person'
                }
            });
    });
    it('should error if column is missing', function () {
        return compiler.compile({
            basisTable: 'Person',
            fields: [
                {
                    basisColumn: 'NOT_HERE'
                },
            ]
        }).should.be.rejectedWith(Error, 'Could not find column');
    });
    it('should map column', function () {
        return compiler.compile({
            basisTable: 'Person',
            fields: [
                {
                    fieldName: 'PersonName',
                    basisColumn: 'Name'
                }
            ]
        }).should.eventually.eql({
                basisTable: {
                    name: 'Person',
                    dbName: 'person'
                },
                fields: [
                    {
                        fieldName: 'PersonName',
                        basisTable: 'Person',
                        stepCount: 0,
                        basisColumn: {
                            name: 'Name'
                        }
                    }
                ]
            });
    });
    // TODO Get the column syntax right
    it.skip('should add join', function () {
        return compiler.compile({
            basisTable: 'Person',
            fields: [
                {
                    fieldName: 'ParentName',
                    basisColumn: 'Name',
                    step: 'p'
                }
            ],
            steps: [
                {
                    name: 'p',
                    join: 'Parent'
                }
            ]
        }).should.eventually.eql({
                basisTable: {
                    name: 'Person',
                    dbName: 'person'
                },
                steps: [
                    {
                        name: 'p',
                        join: {
                            name: 'Parent',
                            table: {
                                name: 'Person',
                                dbName: 'person'
                            },
                            columns: [{
                                from: {
                                    name: 'PersonID'
                                },
                                to: {
                                    name: 'PersonID'
                                }
                            }]
                        },
                        stepCount: 1
                    }
                ],
                fields: [
                    {
                        fieldName: 'ParentName',
                        basisTable: 'Person',
                        step: 'p',
                        stepCount: 1,
                        basisColumn: {
                            name: 'Name'
                        }
                    }
                ]
            });
    });
    // TODO Create test for multiple joins A -> B -> C
    it.skip('should add multiple joins', function () {
    });
});
