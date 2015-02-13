'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    BluebirdPromise = require('bluebird'),
    chai = require('chai'),
    client = config.knex().client;

chai.Should();
chai.use(require('chai-as-promised'));

describe('Model Saver', function () {
    var saver;
    beforeEach(function () {
        saver = proxyquire(configAppRoot + 'services/modelSaver', {});
        this.PersonID = {
            name: 'PersonID',
            basisColumn: {dbName: 'id'},
            updateable: false
        };
        this.modelDefinition = {
            basisTable: {
                dbName: 'person'
            },
            instanceID: this.PersonID,
            fields: [
                this.PersonID,
                {
                    name: 'PersonName',
                    basisColumn: {dbName: 'name'}
                }
            ]
        };
    });

    describe('Simple Model', function () {

        it('should return empty data', function () {
            var dataToSave = [];
            return saver.save(this.modelDefinition, []).should.eventually.eql(dataToSave);
        });

        it('should insert one row', function () {
            var _fakeID = 1;
            client.query = BluebirdPromise.method(function (builder) {
                var sql = builder.toSql(builder);
                var bindings = builder.getBindings();

                var expectedSql = 'insert into `person` (`name`) values (?)';
                chai.assert.equal(sql, expectedSql);
                chai.assert.deepEqual(bindings, ['Foo']);

                return [_fakeID];
            });

            var dataToSave = [
                {state: 'INSERTED', data: {PersonName: 'Foo'}, tempID: 'ASDF1234'}
            ];

            var expected = [
                {data: {PersonName: 'Foo', PersonID: _fakeID}, id: _fakeID, tempID: 'ASDF1234'}
            ];

            return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
        });

        it('should delete one row', function () {
            var dataToSave = [
                {state: 'DELETED', id: 1}
            ];

            var expected = [
                {id: 1}
            ];

            client.query = BluebirdPromise.method(function (builder) {
                var sql = builder.toSql(builder);
                var bindings = builder.getBindings();

                var expectedSql = 'delete from `person` where `id` = ?';
                chai.assert.equal(sql, expectedSql);
                chai.assert.deepEqual(bindings, [1]);

                return 1;
            });

            return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
        });

        it('should delete two rows', function () {
            client.query = BluebirdPromise.method(function () {
                return 1;
            });

            var dataToSave = [
                {state: 'DELETED', id: 1},
                {state: 'DELETED', id: 2}
            ];

            var expected = [
                {id: 1},
                {id: 2}
            ];

            return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
        });

        it('should insert three rows', function () {
            var _counter = 0;
            client.query = BluebirdPromise.method(function () {
                _counter++;
                return [_counter];
            });

            var dataToSave = [
                {state: 'INSERTED', data: {PersonName: 'Foo'}},
                {state: 'INSERTED', data: {PersonName: 'Bar'}},
                {state: 'INSERTED', data: {PersonName: 'Baz'}}
            ];

            var expected = [
                {data: {PersonName: 'Foo', PersonID: 1}, id: 1},
                {data: {PersonName: 'Bar', PersonID: 2}, id: 2},
                {data: {PersonName: 'Baz', PersonID: 3}, id: 3}
            ];

            return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
        });

        it('should update one row', function () {
            var dataToSave = [
                {state: 'UPDATED', id: 1, data: {PersonName: 'Bar', PersonID: 1}}
            ];

            var expected = [
                {id: 1, data: {PersonName: 'Bar', PersonID: 1}}
            ];

            client.query = BluebirdPromise.method(function (builder) {
                var sql = builder.toSql(builder);
                var bindings = builder.getBindings();

                var expectedSql = 'update `person` set `name` = ? where `id` = ?';
                chai.assert.equal(sql, expectedSql);
                chai.assert.deepEqual(bindings, ['Bar', 1]);

                return 1;
            });

            return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
        });

        it('should only update columns on this table', function () {
            this.modelDefinition.fields.push({
                name: 'ParentPersonName',
                basisColumn: {name: 'Name', dbName: 'name'},
                stepCount: 1
            });

            var dataToSave = [
                {state: 'UPDATED', id: 1, data: {PersonName: 'ChildName', PersonID: 1, ParentPersonName: 'ParentName'}}
            ];

            client.query = BluebirdPromise.method(function (builder) {
                var sql = builder.toSql(builder);
                var bindings = builder.getBindings();

                var expectedSql = 'update `person` set `name` = ? where `id` = ?';
                chai.assert.equal(sql, expectedSql);
                chai.assert.deepEqual(bindings, ['ChildName', 1]);

                return 1;
            });

            return saver.save(this.modelDefinition, dataToSave).should.eventually.be.fulfilled;
        });

        it('should insert one row', function () {
            this.modelDefinition.fields[0].basisColumn.columnDefault = 'GUID';

            client.query = BluebirdPromise.method(function (builder) {
                var sql = builder.toSql(builder);
                var expectedSql = 'insert into `person` (`id`, `name`) values (?, ?)';
                chai.assert.equal(sql, expectedSql);
                return null;
            });

            var dataToSave = [
                {state: 'INSERTED', data: {PersonName: 'Foo'}, tempID: 'ASDF1234'}
            ];

            var expected = [
                {data: {PersonName: 'Foo', PersonID: 'ASDF1234'}, id: 'ASDF1234', tempID: 'ASDF1234'}
            ];

            return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
        });
    });

    describe('Complex Model', function () {
        beforeEach(function () {
            this.modelDefinition.children = [{
                name: 'ChildModel',
                basisTable: {
                    dbName: 'person'
                },
                instanceID: {
                    name: 'ChildID',
                    basisColumn: {
                        dbName: 'id'
                    }
                },
                fields: [
                    {
                        name: 'ChildID',
                        basisColumn: {dbName: 'id'},
                        updateable: false
                    },
                    {
                        name: 'ChildName',
                        basisColumn: {dbName: 'name'}
                    }
                ]
            }];
        });

        it('should update child rows too', function () {
            var dataToSave = [{
                state: 'UPDATED',
                id: 1,
                data: {PersonName: 'Bar', PersonID: 1},
                children: {
                    ChildModel: [{
                        state: 'UPDATED',
                        id: 1,
                        data: {ChildName: 'Bar', ChildID: 1}
                    }]
                }
            }];

            var expected = [
                {
                    id: 1,
                    data: {PersonName: 'Bar', PersonID: 1},
                    children: {ChildModel: [{id: 1, data: {ChildName: 'Bar', ChildID: 1}}]}
                }
            ];

            client.query = BluebirdPromise.method(function (builder) {
                var sql = builder.toSql(builder);
                var bindings = builder.getBindings();

                var expectedSql = 'update `person` set `name` = ? where `id` = ?';
                chai.assert.equal(sql, expectedSql);
                chai.assert.deepEqual(bindings, ['Bar', 1]);

                return 1;
            });
            return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
        });
        it('should delete child rows too', function () {
            var dataToSave = [{
                state: 'DELETED',
                id: 1,
                data: {PersonName: 'Bar', PersonID: 1},
                children: {
                    ChildModel: [{
                        state: 'DELETED',
                        id: 1,
                        data: {ChildName: 'Bar', ChildID: 1}
                    }]
                }
            }];

            var expected = [
                {
                    id: 1,
                    data: {PersonName: 'Bar', PersonID: 1},
                    children: {ChildModel: [{id: 1, data: {ChildName: 'Bar', ChildID: 1}}]}
                }
            ];

            client.query = BluebirdPromise.method(function (builder) {
                var sql = builder.toSql(builder);
                var bindings = builder.getBindings();

                var expectedSql = 'delete from `person` where `id` = ?';
                chai.assert.equal(sql, expectedSql);
                chai.assert.deepEqual(bindings, [1]);

                return 1;
            });
            return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
        });
    });

});
