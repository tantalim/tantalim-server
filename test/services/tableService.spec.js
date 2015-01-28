'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
//    sinon = require('sinon'),
    BluebirdPromise = require('bluebird'),
//    knex = require('knex').knex,
    knexProxy = {},
    chai = require('chai');

BluebirdPromise.longStackTraces();
chai.Should();
chai.use(require('chai-as-promised'));

var service = proxyquire(configAppRoot + 'services/tableService', {
    'knex': knexProxy
});

// TODO Get this to pass tests
describe('Table Service', function () {
    it('get table', function () {
        var expected = {
            columns: []
        };
        return service.getTableById('empty').should.eventually.eql(expected);
    });

    it('should get the PK', function () {
        var pk = {
            columnID: 'c1',
            name: 'TableID',
            dbName: 'id'
        };
        var table = {
            primaryIndex: pk
        };

        return service.getPrimaryKey(table).should.eql(pk);
    });
});
