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
    var compiler, PersonTable;

    beforeEach(function () {
        compiler = proxyquire(configAppRoot + 'services/modelCompiler', {
            './pageService': pageService
        });
        PersonTable = {
            name: 'Person',
            dbName: 'person',
            primaryKey: 'PersonID',
            columns: [
                {name: 'PersonID'},
                {name: 'Name', required: true},
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
    });

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
    it('should compile basisTable', function () {
        return compiler.compile({
            basisTable: 'Person',
            fields: [{
                name: 'PersonPersonID',
                basisColumn: 'PersonID'
            }]
        }).should.eventually.have.property('basisTable').eql({
                name: 'Person',
                dbName: 'person'
            });
    });
    it('should error if basis column can\'t be found', function () {
        return compiler.compile({
            name: 'PersonModel',
            basisTable: 'Person',
            fields: [
                {
                    name: 'PersonNotHere',
                    basisColumn: 'NotHere'
                }
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
        }).should.eventually.have.property('fields').eql([
                {
                    name: 'PersonName',
                    basisTable: 'Person',
                    required: true,
                    stepCount: 0,
                    basisColumn: {
                        name: 'Name', required: true
                    }
                }
            ]);
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
        }).should.eventually.have.property('instanceID').eql({
                name: 'PersonPersonID',
                basisTable: 'Person',
                required: false,
                stepCount: 0,
                basisColumn: {
                    name: 'PersonID'
                }
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
                        required: true,
                        stepCount: 1,
                        basisColumn: {
                            name: 'Name', required: true
                        }
                    }
                ]
            });
    });
    it.skip('should add multiple joins', function () {
        // TODO Create test for multiple joins A -> B -> C
    });
    it('should require parentLink', function () {
        return compiler.compile({
            basisTable: 'Person',
            children: [{
                name: 'Child',
                basisTable: 'Person'
            }]
        }).should.be.rejectedWith(Error, 'Child model Child must define a parentLink');
    });
    it('should error with invalid parentLink columns', function () {
        return compiler.compile({
            name: 'Person',
            basisTable: 'Person',
            children: [{
                name: 'Child',
                basisTable: 'Person',
                parentLink: {
                    parentField: 'FieldNotHere',
                    childField: 'FieldNotHere'
                }
            }]
        }).should.be.rejectedWith(Error, 'Parent model Person is missing parentField named FieldNotHere');
    });
    it('should add child view', function () {
        return compiler.compile({
            basisTable: 'Person',
            fields: [
                {
                    name: 'PersonPersonID',
                    basisColumn: 'PersonID'
                }
            ],
            children: [{
                name: 'Child',
                basisTable: 'Person',
                parentLink: {
                    parentField: 'PersonPersonID',
                    childField: 'ChildParentID'
                },
                fields: [
                    {
                        name: 'ChildName',
                        basisColumn: 'Name'
                    },
                    {
                        name: 'ChildParentID',
                        basisColumn: 'ParentID'
                    }
                ]
            }]
        }).should.eventually.have.property('children').eql([{
                name: 'Child',
                basisTable: {
                    name: 'Person',
                    dbName: 'person'
                },
                parentLink: {
                    parentField: 'PersonPersonID',
                    childField: 'ChildParentID'
                },
                fields: [
                    {
                        name: 'ChildName',
                        stepCount: 0,
                        basisTable: 'Person',
                        required: true,
                        basisColumn: {
                            name: 'Name', required: true
                        }
                    },
                    {
                        name: 'ChildParentID',
                        stepCount: 0,
                        required: false,
                        basisTable: 'Person',
                        basisColumn: {
                            name: 'ParentID'
                        }
                    }

                ]
            }]);
    });

});
