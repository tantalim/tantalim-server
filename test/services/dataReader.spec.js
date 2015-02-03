'use strict';

var config = require('../config'),
    BluebirdPromise = require('bluebird'),
    client = config.knex().client,
    chai = require('chai')
    ;

chai.Should();
chai.use(require('chai-as-promised'));

var service = require('../' + config.appRoot + 'app/services/dataReader');

describe('Data Reader Service', function () {
    describe('using simple model', function () {
        var model;

        beforeEach(function () {
            var lastName = {'fieldName': 'PersonLastName', 'basisColumn': {'dbName': 'lastName'}};

            model = {
                basisTable: {dbName: 'person'},
                instanceID: 'PersonLastName',
                foreignKey: 'PersonLastName',
                fields: [lastName]
            };
        });

        it('should error if database is down', function () {
            client.query = BluebirdPromise.method(function () {
                throw 'database is down';
            });
            return service.getData(model).should.be.rejected;
        });
        it('should sort by name', function () {
            model.orderBy = [
                {fieldName: 'PersonLastName', direction: 'DESC'}
            ];

            client.query = BluebirdPromise.method(function (sql) {
                var expected = 'select `t0`.`lastName` as `PersonLastName` ' +
                    'from `person` as `t0` order by `PersonLastName` DESC';
                sql.toSql().should.equal(expected);
                return [];
            });
            return service.getData(model);
        });
        it('should limit 100', function () {
            model.limit = 100;

            client.query = BluebirdPromise.method(function (sql) {
                var expected = 'select `t0`.`lastName` as `PersonLastName` ' +
                    'from `person` as `t0` limit 100';
                sql.toSql().should.equal(expected);
                return [];
            });
            return service.getData(model);
        });
        it('should page', function () {
            model.limit = 100;

            client.query = BluebirdPromise.method(function (sql) {
                var expected = 'select `t0`.`lastName` as `PersonLastName` ' +
                    'from `person` as `t0` limit 100 offset 400';
                sql.toSql().should.equal(expected);
                return [];
            });
            return service.getData(model, '', 5);
        });
        it('should query one row', function () {
            client.query = BluebirdPromise.method(function () {
                return [{
                    PersonLastName: 'Allred'
                }];
            });
            return service.getData(model).should.become([{
                id: 'Allred',
                foreignKey: 'Allred',
                data: {
                    PersonLastName: 'Allred'
                }
            }]);
        });
    });
    it('should convert boolean fieldtypes', function () {
        var model = {
            basisTable: {dbName: 'person'},
            fields: [{
                'fieldName': 'BooleanField',
                'dataType': 'Boolean',
                'basisColumn': {'dbName': 'booleanField'}
            }]
        };

        client.query = BluebirdPromise.method(function () {
            return [{
                BooleanField: '1'
            }];
        });

        return service.getData(model).should.become([{
            data: {
                BooleanField: true
            }
        }]);
    });
    describe('using model with join', function () {
        var model;

        beforeEach(function () {
            var lastName = {'fieldName': 'PersonLastName', 'basisColumn': {'dbName': 'lastName'}};

            model = {
                basisTable: {dbName: 'person'},
                fields: [lastName],
                steps: [{
                    stepStepID: 101,
                    joinRequired: false,
                    joinToTableSql: 'department',
                    joinColumns: [{
                        fromColSql: 'departmentID',
                        toColSql: 'id'
                    }]
                }]
            };
        });

        it('should left join to table', function () {
            client.query = BluebirdPromise.method(function (sql) {
                var expected = 'select `t0`.`lastName` as `PersonLastName` ' +
                    'from `person` as `t0` left join `department` as `t1` on `t1`.`id` = `t0`.`departmentID`';
                sql.toSql().should.equal(expected);
                return [];
            });

            return service.getData(model);
        });

        it('should left join with string to table', function () {
            model.steps[0].joinColumns[0].fromText = '1';
            client.query = BluebirdPromise.method(function (sql) {
                var expected = 'select `t0`.`lastName` as `PersonLastName` ' +
                    'from `person` as `t0` left join `department` as `t1` on `t1`.`id` = \'1\'';
                sql.toSql().should.equal(expected);
                return [];
            });

            return service.getData(model);
        });
    });
    describe('using parent-child model', function () {
        var model;

        beforeEach(function () {
            model = {
                basisTable: {dbName: 'person'},
                instanceID: 'PersonID',
                fields: [
                    {'fieldName': 'PersonID', 'basisColumn': {'dbName': 'id'}},
                    {'fieldName': 'PersonName', 'basisColumn': {'dbName': 'name'}}
                ],
                children: [
                    {
                        data: {
                            modelName: 'Child'
                        },
                        foreignKeys: [{
                            parentField: 'PersonID',
                            childField: 'ParentID'
                        }],
                        basisTable: {dbName: 'child'},
                        fields: [
                            //{'fieldName': 'ChildID', 'basisColumn': {'dbName': 'id'}},
                            {'fieldName': 'ParentID', 'basisColumn': {'dbName': 'parentID'}},
                            {'fieldName': 'ChildName', 'basisColumn': {'dbName': 'name'}}
                        ]
                    }]
            };
        });

        it('should query data', function () {
            client.query = BluebirdPromise.method(function (sql) {
                var queryText = sql.toSql();
                if (queryText.indexOf('Child') > 0) {
                    var expected = 'select `t0`.`parentID` as `ParentID`, `t0`.`name` as `ChildName` ' +
                        'from `child` as `t0` where `t0`.`parentID` in (?, ?)';
                    queryText.should.equal(expected);
                    sql.bindings.should.eql(['1', '2']);
                    return [{
                        ChildID: 2,
                        ParentID: 1,
                        ChildName: 'Doe'
                    }];
                } else {
                    return [
                        {
                            PersonID: 1,
                            PersonName: 'John'
                        },
                        {
                            PersonID: 2,
                            PersonName: 'Mike'
                        }
                    ];
                }
            });
            return service.getData(model).should.become([
                {
                    id: 1,
                    data: {
                        PersonID: 1,
                        PersonName: 'John'
                    },
                    children: {
                        Child: [{
                            data: {
                                ChildID: 2,
                                ParentID: 1,
                                ChildName: 'Doe'
                            }
                        }]
                    }
                },
                {
                    id: 2,
                    data: {
                        PersonID: 2,
                        PersonName: 'Mike'
                    },
                    children: {
                        Child: []
                    }
                }
            ]);
        });

        it('should error on child data', function () {
            client.query = BluebirdPromise.method(function (sql) {
                var queryText = sql.toSql();
                if (queryText.indexOf('Child') > 0) {
                    throw 'foo';
                } else {
                    return [{
                        PersonID: 1,
                        PersonName: 'John'
                    }];
                }
            });
            return service.getData(model).should.be.rejected;
        });

    });
    describe('using parent-child-grandchild model', function () {
        var model;

        beforeEach(function () {
            model = {
                basisTable: {dbName: 'person'},
                fields: [{'fieldName': 'PersonName', 'basisColumn': {'dbName': 'name'}}],
                children: [
                    {
                        data: {
                            modelName: 'Child'
                        },
                        foreignKeys: [{
                            parentField: 'PersonName',
                            childField: 'ChildName'
                        }],
                        steps: [
                            {
                                stepStepID: '20',
                                stepPreviousStepID: null,
                                joinToTableSql: 'company',
                                joinRequired: '1',
                                joinColumns: [
                                    {fromColSql: 'companyID', toColSql: 'id'}
                                ]
                            }
                        ],
                        basisTable: {dbName: 'child'},
                        fields: [{'fieldName': 'ChildName', 'basisColumn': {'dbName': 'name'}}],
                        children: [
                            {
                                data: {
                                    modelName: 'Grandchild'
                                },
                                foreignKeys: [{
                                    parentField: 'ChildName',
                                    childField: 'GrandchildName'
                                }],
                                basisTable: {dbName: 'grandchild'},
                                fields: [{'fieldName': 'GrandchildName', 'basisColumn': {'dbName': 'name'}}]
                            }
                        ]
                    }]
            };
            client.query = BluebirdPromise.method(function (sql) {
                var queryText = sql.toSql();
                if (queryText.indexOf('Grand') > 0) {
                    return [{
                        GrandchildName: 'Allred'
                    }];
                } else if (queryText.indexOf('Child') > 0) {
                    return [{
                        ChildName: 'Allred'
                    }];
                } else {
                    return [{
                        PersonName: 'Allred'
                    }];
                }
            });
        });

        it.skip('should join to company and industry', function () {
            var model = {
                basisTable: {dbName: 'person'},
                fields: [
                    {fieldName: 'PersonName', basisColumn: {dbName: 'name'}},
                    {fieldName: 'PersonCompanyName', basisColumn: {dbName: 'name'}, fieldStepID: '20'},
                    {fieldName: 'PersonCompanyIndustryName', basisColumn: {dbName: 'name'}, fieldStepID: '21'}
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

        it('should query data', function () {
            return service.getData(model).should.become([{
                data: {PersonName: 'Allred'},
                children: {
                    Child: [{
                        data: {ChildName: 'Allred'},
                        children: {
                            Grandchild: [{
                                data: {GrandchildName: 'Allred'}
                            }]
                        }
                    }]
                }
            }]);
        });
    });
});
