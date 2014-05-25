'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    Promise = require('bluebird'),
    knexProxy = {knex: {}},
    tableServiceProxy = {},
    chai = require('chai');

chai.Should();
chai.use(require('chai-as-promised'));

describe('Model Saver', function () {
    var saver;

    beforeEach(function () {
        saver = proxyquire(configAppRoot + 'services/modelSaver', {
            'knex': knexProxy,
            './tableService': tableServiceProxy
        });
        knexProxy.knex = {};
        knexProxy.knex.client = {};

        this.modelDefinition = {
            data: { modelName: 'UnitTestModel' },
            basisTable: {
                tableName: 'TestUnit',
                dbName: 'test_unit',
                primaryKey: {columnName: 'ID', dbName: 'id'}
            },
            primaryKey: {
                fieldName: 'TestID'
            },
            fields: [
                {
                    fieldName: 'TestID',
                    basisColumn: {columnName: 'ID', dbName: 'id'},
                    fieldStep: null,
                    updateable: false
                },
                {
                    fieldName: 'TestName',
                    basisColumn: {columnName: 'Name', dbName: 'name'},
                    fieldStep: null
                }
            ],
            fieldSteps: []
        };
    });

    it('should return empty data', function () {
        var dataToSave = [];
        return saver.save(this.modelDefinition, []).should.eventually.eql(dataToSave);
    });

    it('should insert one row', function () {
        var _fakeID = 1;
        knexProxy.knex.client.query = Promise.method(function (builder) {
            var sql = builder.toSql(builder);
            var bindings = builder.getBindings();

            var expectedSql = 'insert into `test_unit` (`name`) values (?)';
            chai.assert.equal(sql, expectedSql);
            chai.assert.deepEqual(bindings, ['Foo']);

            return [_fakeID];
        });

        var dataToSave = [
            { state: 'INSERTED', data: { TestName: 'Foo' }, tempID: 'ASDF1234' }
        ];

        var expected = [
            { data: { TestName: 'Foo', TestID: _fakeID }, id: _fakeID, tempID: 'ASDF1234' }
        ];

        return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
    });

    it('should delete one row', function () {
        var dataToSave = [
            { state: 'DELETED', id: 1 }
        ];

        var expected = [
            {id: 1}
        ];

        knexProxy.knex.client.query = Promise.method(function (builder) {
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
        knexProxy.knex.client.query = Promise.method(function () {
            return 1;
        });

        var dataToSave = [
            { state: 'DELETED', id: 1 },
            { state: 'DELETED', id: 2 }
        ];

        var expected = [
            {id: 1},
            {id: 2}
        ];

        return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
    });

    it('should insert three rows', function () {
        var _counter = 0;
        knexProxy.knex.client.query = Promise.method(function () {
            _counter++;
            return [_counter];
        });

        var dataToSave = [
            { state: 'INSERTED', data: { TestName: 'Foo' } },
            { state: 'INSERTED', data: { TestName: 'Bar' } },
            { state: 'INSERTED', data: { TestName: 'Baz' } }
        ];

        var expected = [
            { data: { TestName: 'Foo', TestID: 1 }, id: 1 },
            { data: { TestName: 'Bar', TestID: 2 }, id: 2 },
            { data: { TestName: 'Baz', TestID: 3 }, id: 3 }
        ];

        return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
    });

    it('should update one row', function () {
        var dataToSave = [
            { state: 'UPDATED', id: 1, data: { TestName: 'Bar', TestID: 1 } }
        ];

        var expected = [
            { id: 1, data: { TestName: 'Bar', TestID: 1 } }
        ];

        knexProxy.knex.client.query = Promise.method(function (builder) {
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
            fieldName: 'ParentTestName',
            basisColumn: {columnName: 'Name', dbName: 'name'},
            fieldStep: 1
        });

        this.modelDefinition.fieldSteps.push({
        });

        var dataToSave = [
            { state: 'UPDATED', id: 1, data: { TestName: 'ChildName', TestID: 1, ParentTestName: 'ParentName' } }
        ];

        knexProxy.knex.client.query = Promise.method(function (builder) {
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

        knexProxy.knex.client.query = Promise.method(function (builder) {
            var sql = builder.toSql(builder);
            var expectedSql = 'insert into `test_unit` (`id`, `name`) values (?, ?)';
            chai.assert.equal(sql, expectedSql);
            return null;
        });

        var dataToSave = [
            { state: 'INSERTED', data: { TestName: 'Foo' }, tempID: 'ASDF1234' }
        ];

        var expected = [
            { data: { TestName: 'Foo', TestID: 'ASDF1234' }, id: 'ASDF1234', tempID: 'ASDF1234' }
        ];

        return saver.save(this.modelDefinition, dataToSave).should.eventually.eql(expected);
    });


});
