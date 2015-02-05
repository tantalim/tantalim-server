'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    BluebirdPromise = require('bluebird'),
    pageService = {},
    chai = require('chai');

chai.Should();
chai.use(require('chai-as-promised'));

describe('Model Compiler', function () {
    var compiler;

    beforeEach(function () {
        compiler = proxyquire(configAppRoot + 'services/modelCompiler', {
            './pageService': pageService
        });
    });

    var PersonTable = {
        name: 'Person',
        dbName: 'person',
        primaryKey: 'PersonID',
        columns: [
            {name: 'PersonID'},
            {name: 'Name'},
            {name: 'ParentID'}
        ],
        joins: [{
            name: 'Parent',
            table: 'Person',
            required: false,
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
            name: 'PersonModel',
            basisTable: 'Person',
            fields: [
                {
                    name: 'PersonNotHere',
                    basisColumn: 'NotHere'
                },
            ]
        }).should.be.rejectedWith(Error, 'Could not find basis column for PersonNotHere on PersonModel');
    });
    it('should map column', function () {
        return compiler.compile({
            basisTable: 'Person',
            fields: [
                {
                    name: 'PersonName',
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
                        name: 'PersonName',
                        basisTable: 'Person',
                        stepCount: 0,
                        basisColumn: {
                            name: 'Name'
                        }
                    }
                ]
            });
    });
    it('should add instanceID', function () {
        return compiler.compile({
            basisTable: 'Person',
            fields: [
                {
                    name: 'PersonPersonID',
                    basisColumn: 'PersonID'
                }
            ]
        }).should.eventually.eql({
                basisTable: {
                    name: 'Person',
                    dbName: 'person'
                },
                instanceID: {
                    name: 'PersonPersonID',
                    basisTable: 'Person',
                    stepCount: 0,
                    basisColumn: {
                        name: 'PersonID'
                    }
                },
                fields: [
                    {
                        name: 'PersonPersonID',
                        basisTable: 'Person',
                        stepCount: 0,
                        basisColumn: {
                            name: 'PersonID'
                        }
                    }
                ]
            });
    });
    it('should add join', function () {
        return compiler.compile({
            basisTable: 'Person',
            fields: [
                {
                    name: 'ParentName',
                    basisColumn: 'Name',
                    step: 'p'
                }
            ],
            steps: [
                {
                    name: 'p',
                    join: 'Parent',
                    required: true
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
                        required: true,
                        join: {
                            name: 'Parent',
                            table: {
                                name: 'Person',
                                dbName: 'person'
                            },
                            columns: [{
                                from: {
                                    name: 'ParentID'
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
                        name: 'ParentName',
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
    it('should have child view', function () {
        return compiler.compile({
            basisTable: 'Person',
            children: [{
                name: 'Child',
                basisTable: 'Person'
            }]
        }).should.eventually.eql({
                basisTable: {
                    name: 'Person',
                    dbName: 'person'
                },
                children: [{
                    name: 'Child',
                    basisTable: {
                        name: 'Person',
                        dbName: 'person'
                    }
                }]
            });
    });

});
