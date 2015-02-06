'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    BluebirdPromise = require('bluebird'),
    tableServiceProxy = {},
    chai = require('chai'),
    client = config.knex().client;

chai.Should();
chai.use(require('chai-as-promised'));

describe('Model Saver', function () {
    var saver;

    beforeEach(function () {
        saver = proxyquire(configAppRoot + 'services/modelSaver', {
            './tableService': tableServiceProxy
        });

        this.modelDefinition = {
            name: 'UnitTestModel',
            basisTable: {
                tableName: 'TestUnit',
                dbName: 'test_unit'
            },
            instanceID: {
                name: 'TestID',
                basisColumn: {
                    dbName: 'id'
                }
            },
            fields: [
                {
                    name: 'TestID',
                    basisColumn: {dbName: 'id'},
                    updateable: false
                },
                {
                    name: 'TestName',
                    basisColumn: {dbName: 'name'}
                }
            ]
        };
    });

    it('should return empty data', function () {
        var dataToSave = [];
        return saver.save(this.modelDefinition, []).should.eventually.eql(dataToSave);
    });

    it('should insert one row', function () {
        var _fakeID = 1;
        client.query = BluebirdPromise.method(function (builder) {
            var sql = builder.toSql(builder);
            var bindings = builder.getBindings();

            var expectedSql = 'insert into `test_unit` (`name`) values (?)';
            chai.assert.equal(sql, expectedSql);
            chai.assert.deepEqual(bindings, ['Foo']);

            return [_fakeID];
        });

        var dataToSave = [
            {state: 'INSERTED', data: {TestName: 'Foo'}, tempID: 'ASDF1234'}
        ];

        var expected = [
            {data: {TestName: 'Foo', TestID: _fakeID}, id: _fakeID, tempID: 'ASDF1234'}
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

            var expectedSql = 'delete from `test_unit` where `id` = ?';
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
            {state: 'INSERTED', data: {TestName: 'Foo'}},
            {state: 'INSERTED', data: {TestName: 'Bar'}},
            {state: 'INSERTED', data: {TestName: 'Baz'}}
        ];

        var expected = [
            {data: {TestName: 'Foo', TestID: 1}, id: 1},
            {data: {TestName: 'Bar', TestID: 2}, id: 2},
            {data: {TestName: 'Baz', TestID: 3}, id: 3}
        ];

        return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
    });

    it('should update one row', function () {
        var dataToSave = [
            {state: 'UPDATED', id: 1, data: {TestName: 'Bar', TestID: 1}}
        ];

        var expected = [
            {id: 1, data: {TestName: 'Bar', TestID: 1}}
        ];

        client.query = BluebirdPromise.method(function (builder) {
            var sql = builder.toSql(builder);
            var bindings = builder.getBindings();

            var expectedSql = 'update `test_unit` set `name` = ? where `id` = ?';
            chai.assert.equal(sql, expectedSql);
            chai.assert.deepEqual(bindings, ['Bar', 1]);

            return 1;
        });

        return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
    });

    it('should only update columns on this table', function () {
        this.modelDefinition.fields.push({
            name: 'ParentTestName',
            basisColumn: {name: 'Name', dbName: 'name'},
            stepCount: 1
        });

        var dataToSave = [
            {state: 'UPDATED', id: 1, data: {TestName: 'ChildName', TestID: 1, ParentTestName: 'ParentName'}}
        ];

        client.query = BluebirdPromise.method(function (builder) {
            var sql = builder.toSql(builder);
            var bindings = builder.getBindings();

            var expectedSql = 'update `test_unit` set `name` = ? where `id` = ?';
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
            var expectedSql = 'insert into `test_unit` (`id`, `name`) values (?, ?)';
            chai.assert.equal(sql, expectedSql);
            return null;
        });

        var dataToSave = [
            {state: 'INSERTED', data: {TestName: 'Foo'}, tempID: 'ASDF1234'}
        ];

        var expected = [
            {data: {TestName: 'Foo', TestID: 'ASDF1234'}, id: 'ASDF1234', tempID: 'ASDF1234'}
        ];

        return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
    });


});
