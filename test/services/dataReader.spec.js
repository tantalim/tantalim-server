'use strict';

var config = require('../config');
var service = require('../' + config.appRoot + 'app/services/dataReader');
var should = require('should');

describe('Data Reader Service', function () {
    describe.skip('getModelSql', function () {
        // TODO Mock the knex module inside dataReader service
        it('should select person', function () {
            var model = {
                basisTable: { dbName: 'person'},
                fields: [
                    { fieldName: 'PersonFirstName', basisColumn: {dbName: 'firstName'} },
                    { fieldName: 'PersonLastName', basisColumn: {dbName: 'lastName'} }
                ]
            };

            var sql = service.getModelSql(model);
            var expected = 'select `t0`.`firstName` as `PersonFirstName`, `t0`.`lastName` as `PersonLastName` ' +
                'from `person` as `t0`';
            sql.toSql().should.equal(expected);
        });

        it('should join to company and industry', function () {
            var model = {
                basisTable: { dbName: 'person'},
                fields: [
                    { fieldName: 'PersonName', basisColumn: {dbName: 'name'} },
                    { fieldName: 'PersonCompanyName', basisColumn: {dbName: 'name'}, fieldStepID: '20' },
                    { fieldName: 'PersonCompanyIndustryName', basisColumn: {dbName: 'name'}, fieldStepID: '21' }
                ],
                steps: [
                    {
                        stepStepID: '20',
                        stepPreviousStepID: null,
                        joinToTableSql: 'company',
                        joinRequired: '1',
                        joinColumns: [
                            {fromColSql: 'companyID', toColSql: 'id'}
                        ]
                    },
                    {
                        stepStepID: '21',
                        stepPreviousStepID: '20',
                        joinToTableSql: 'industry',
                        joinRequired: '0',
                        joinColumns: [
                            {fromColSql: 'industryCode', toColSql: 'code'}
                        ]
                    }

                ]
            };

            var sql = service.getModelSql(model);
            var expected = 'select ' +
                '`t0`.`name` as `PersonName`, ' +
                '`t1`.`name` as `PersonCompanyName`, ' +
                '`t2`.`name` as `PersonCompanyIndustryName` ' +
                'from `person` as `t0` ' +
                'inner join `company` as `t1` on `t1`.`id` = `t0`.`companyID` ' +
                'left join `industry` as `t2` on `t2`.`code` = `t1`.`industryCode`';
            sql.toSql().should.equal(expected);
        });

        it('should join with complex on clause', function () {
            var model = {
                basisTable: { dbName: 'person'},
                steps: [
                    {
                        stepStepID: '20',
                        stepPreviousStepID: null,
                        joinToTableSql: 'company',
                        joinRequired: '1',
                        joinColumns: [
                            {fromColSql: 'industryCode', fromText: null, toColSql: 'code'},
                            {fromColSql: null, fromText: 'Y', toColSql: 'active'}
                        ]
                    }
                ]
            };

            var sql = service.getModelSql(model);
            var expected = 'select * from `person` as `t0` ' +
                'inner join `company` as `t1` on `t1`.`code` = `t0`.`industryCode` and `t1`.`active` = \'Y\'';
            sql.toSql().should.equal(expected);
        });

        it('should order by last name', function () {
            var model = {
                basisTable: { dbName: 'person'},
                orderBy: [
                    {fieldName: 'PersonLastName', direction: 'DESC'}
                ],
                fields: [
                    { fieldName: 'PersonFirstName', basisColumn: {dbName: 'firstName'} },
                    { fieldName: 'PersonLastName', basisColumn: {dbName: 'lastName'} }
                ]
            };

            var sql = service.getModelSql(model);
            var expected = 'select `t0`.`firstName` as `PersonFirstName`, `t0`.`lastName` as `PersonLastName` ' +
                'from `person` as `t0` order by `PersonLastName` DESC';
            sql.toSql().should.equal(expected);
        });

    });
    describe('getParentFieldByChildStep', function () {
        it('should find field by column sql in step', function () {
            var parentFields = [
                { fieldName: 'DepartmentID', basisColumn: {dbName: 'id'} },
                { fieldName: 'DepartmentParentID', basisColumn: {dbName: 'id'}, fieldStepID: 'NOT_ME' },
                { fieldName: 'DepartmentName', basisColumn: {dbName: 'name'} }
            ];
            var childStepJoinColumns = [
                {fromColSql: 'departmentID', toColSql: 'id'}
            ];
            var parentField = service.getParentFieldByChildStep(parentFields, childStepJoinColumns);
            parentField.should.equal('DepartmentID');
        });

        it('should not support two join columns', function () {
            var childStepJoinColumns = [
                {fromColSql: 'industryCode', fromText: null, toColSql: 'code'},
                {fromColSql: null, fromText: 'Y', toColSql: 'active'}
            ];

            should(function () {
                service.getParentFieldByChildStep([], childStepJoinColumns);
            }).throw();
        });

        it('should require a join column', function () {
            should(function () {
                service.getParentFieldByChildStep([], []);
            }).throw();
        });

        it('should require field with sql to be present', function () {
            var childStepJoinColumns = [
                {fromColSql: 'departmentID', toColSql: 'id'}
            ];
            should(function () {
                service.getParentFieldByChildStep([], childStepJoinColumns);
            }).throw();
        });

    });
    describe('addChildrenToParent', function () {
        it('should do nothing', function () {
            var parentData = [];
            service.addChildrenToParent(parentData);
            parentData.length.should.equal(0);
        });

        it('should add empty child data', function () {
            var parentData = [
                {
                    id: '1',
                    data: { ID: '1', Name: 'Table1'}
                }
            ];
            service.addChildrenToParent(parentData, 'foo', []);
            should(parentData[0].children.foo).eql([]);
        });

        it('should add empty child data', function () {
            var parentData = [
                {
                    id: '1',
                    data: { ID: '1', Name: 'Table1'}
                }
            ];
            var children = [
                {
                    id: '1',
                    foreignKey: '1',
                    data: { ID: '1', Name: 'Column1', TableID: '1' }
                }
            ];
            service.addChildrenToParent(parentData, 'foo', children);
            should(parentData[0].children.foo[0].data).eql(children[0].data);
        });
    });
    describe('addKeysToData', function () {
        it('should do nothing', function () {
            var results = service.addKeysToData([]);
            results.length.should.equal(0);
        });

        it('should get the same number of rows', function () {
            var testData = [
                { foo: '1'}
            ];
            var results = service.addKeysToData(testData);
            results.length.should.equal(testData.length);
        });

        it('should put the data in', function () {
            var testData = [
                { foo: '1'}
            ];
            var results = service.addKeysToData(testData);
            should(results[0].data).eql(testData[0]);
        });

        it('should set the primary key', function () {
            var testData = [
                { foo: '1'}
            ];
            var results = service.addKeysToData(testData, {fieldName: 'foo'});
            should(results[0].id).eql('1');
        });

        it('should set the foreign key', function () {
            var testData = [
                { id: '1', foreignKey: '2'}
            ];
            var results = service.addKeysToData(testData, 'id', 'foreignKey');
            should(results[0].foreignKey).eql('2');
        });
    });
});
