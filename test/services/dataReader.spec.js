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
            var lastName = {
                name: 'PersonLastName',
                basisColumn: {dbName: 'lastName'},
                stepCount: 0
            };

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
                name: 'BooleanField',
                dataType: 'Boolean',
                basisColumn: {dbName: 'booleanField'}
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
            var lastName = {
                name: 'PersonLastName',
                basisColumn: {dbName: 'lastName'},
                stepCount: 0
            };

            model = {
                basisTable: {dbName: 'person'},
                fields: [lastName],
                steps: [{
                    name: '101',
                    required: false,
                    join: {
                        table: {
                            dbName: 'department'
                        },
                        columns: [{
                            from: {
                                dbName: 'departmentID'
                            },
                            to: {
                                dbName: 'id'
                            }
                        }]
                    },
                    stepCount: 1
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
            model.steps[0].join.columns[0].fromText = '1';
            delete model.steps[0].join.columns[0].from;
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
                name: 'Person',
                basisTable: {dbName: 'person'},
                instanceID: 'PersonID',
                fields: [
                    {name: 'PersonID', basisColumn: {dbName: 'id'}, stepCount: 0},
                    {name: 'PersonName', basisColumn: {dbName: 'name'}, stepCount: 0}
                ],
                children: [
                    {
                        name: 'Child',
                        parentLink: {
                            parentField: 'PersonID',
                            childField: 'ParentID'
                        },
                        basisTable: {dbName: 'child'},
                        fields: [
                            {name: 'ParentID', basisColumn: {dbName: 'parentID'}, stepCount: 0},
                            {name: 'ChildName', basisColumn: {dbName: 'name'}, stepCount: 0}
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
                fields: [{name: 'PersonName', basisColumn: {dbName: 'name'}, stepCount: 0}],
                children: [
                    {
                        name: 'Child',
                        parentLink: {
                            parentField: 'PersonName',
                            childField: 'ChildName'
                        },
                        basisTable: {dbName: 'child'},
                        fields: [{name: 'ChildName', basisColumn: {dbName: 'name'}, stepCount: 0}],
                        children: [
                            {
                                name: 'Grandchild',
                                parentLink: {
                                    parentField: 'ChildName',
                                    childField: 'GrandchildName'
                                },
                                basisTable: {dbName: 'grandchild'},
                                fields: [{name: 'GrandchildName', basisColumn: {dbName: 'name'}, stepCount: 0}]
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
