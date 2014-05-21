'use strict';

var Promise = require('bluebird');

exports.getTableById = function (tableID) {
    return new Promise(function (resolve) {
        var table = {
            columns: []
        };

        if (tableID === 't123') {
            table.tableID = 't123';
            table.name = 'Table';
            table.dbName = 'unittest';
            table.primaryIndex = 'TableID';
            table.columns = [
                {
                    columnID: 'c1',
                    name: 'TableID',
                    colSql: 'id'
                },
                {
                    columnID: 'c2',
                    name: 'Name',
                    colSql: 'name'
                }
            ];
        }

//        _.forEach(modelDefinition.fields, function (field) {
//            var column = {
//                name: field.colName,
//                colSql: field.colSql
//            };
//            table.columns.push(column);
//        });

        resolve(table);
    });
};

exports.getPrimaryKey = function (table) {
    var primaryKeyColumn = table.primaryIndex;
    if (!primaryKeyColumn) {
        console.error(table);
        throw new Error('Could not find primary key');
    }
    return primaryKeyColumn;
};
