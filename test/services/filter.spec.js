'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    knex = require('knex').knex,
    filter = require(configAppRoot + 'services/filter'),
    chai = require('chai');

chai.Should();

describe('Filter', function () {
    var sql;

    var modelColumns = [
        {
            fieldName: 'TableID',
            sql: 'id',
            dataType: 'Integer'
        },
        {
            fieldName: 'CreatedDate',
            sql: 'created_date',
            dataType: 'Date'
        },
        {
            fieldName: 'TableName',
            sql: 'name',
            dataType: 'String'
        }
    ];

    beforeEach(function () {
        sql = knex('foo');
    });

    var expect = function (expected) {
        sql.toString().should.equal('select * from `foo` where ' + expected);
    };

    var applyFilter = function (filterString) {
        filter.apply(filterString, sql, modelColumns);
    };

    describe('general', function () {
        it('should do nothing', function () {
            applyFilter('');
            sql.toString().should.equal('select * from `foo`');
        });

        it('should filter equals', function () {
            applyFilter('TableName = Person');
            expect('`name` = \'Person\'');
        });
    });

    describe('strings', function () {
        it('should filter begins with', function () {
            applyFilter('TableName BeginsWith Foo');
            expect('`name` like \'Foo%\'');
        });
        it('should filter contains', function () {
            applyFilter('TableName Contains Foo');
            expect('`name` like \'%Foo%\'');
        });
        it('should filter ends with', function () {
            applyFilter('TableName EndsWith Foo');
            expect('`name` like \'%Foo\'');
        });
    });

    describe('numbers', function () {
        it('should parse IN clause', function () {
            applyFilter('TableID IN 1,2');
            expect('`id` in (\'1\', \'2\')');
        });
    });

    describe('dates', function () {
        it('should filter IsPast', function () {
            applyFilter('CreatedDate Before NOW');
            expect('`created_date` < NOW()');
        });
        it('should filter more than 2 days from now', function () {
            applyFilter('CreatedDate After 2d');
            expect('`created_date` > DATE_ADD(NOW(), INTERVAL 2 DAY)');
        });
        it('should filter after 12 months ago', function () {
            applyFilter('CreatedDate After -12MONTHS');
            expect('`created_date` > DATE_SUB(NOW(), INTERVAL 12 MONTH)');
        });
    });

    describe('complex', function () {
        it('should parse AND clause', function () {
            applyFilter('TableName = Person AND TableID > 2');
            expect('`name` = \'Person\' and `id` > \'2\'');
        });
    });
});
