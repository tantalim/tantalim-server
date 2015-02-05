'use strict';

var logger = require('../logger/default').main,
    _ = require('lodash'),
    pageService = require('./pageService'),
    BluebirdPromise = require('bluebird');

var ARTIFACT = pageService.ARTIFACT;

var tables = {};

function compile(modelDefinition) {
    logger.info('Starting compile', modelDefinition);

    function parseAndCompile(modelDefinition) {
        var todo = [];

        if (!modelDefinition.basisTable) {
            throw Error('basisTable is required');
        }
        if (typeof modelDefinition.basisTable === 'string') {
            if (modelDefinition.basisTable in tables) {
                var tableDefinition = tables[modelDefinition.basisTable];
                modelDefinition.basisTable = {
                    name: tableDefinition.name,
                    dbName: tableDefinition.dbName
                };
            } else {
                todo.push(pageService.getDefinition(ARTIFACT.TABLE, modelDefinition.basisTable)
                    .then(function (tableDefinition) {
                        tables[tableDefinition.name] = tableDefinition;
                    }));
            }
        }

        var stepCount = 0;
        _.forEach(modelDefinition.steps, function (step) {
            if (step.join) {
                stepCount++;
                step.stepCount = stepCount;

                var fromTable = modelDefinition.basisTable;

                if (typeof fromTable === 'object' && typeof step.join === 'string') {
                    fromTable = tables[fromTable.name];
                    var join = _.find(fromTable.joins, function (join) {
                        if (join.name === step.join) {
                            return join;
                        }
                    });

                    if (join.table in tables) {
                        var tableDefinition = tables[join.table];
                        step.join = {
                            name: step.join,
                            table: {
                                name: tableDefinition.name,
                                dbName: tableDefinition.dbName
                            }
                        };

                        step.join.columns = _.map(join.columns, function(column) {
                            return column;
                        });

                    } else {
                        todo.push(pageService.getDefinition(ARTIFACT.TABLE, join.table)
                            .then(function (tableDefinition) {
                                tables[tableDefinition.name] = tableDefinition;
                            }));
                    }

                }
            } else {
                throw Error('Model steps must define a join: ' + step);
            }
        });

        if (todo.length == 0) {
            _.forEach(modelDefinition.fields, function (field) {
                if (typeof field.basisColumn === 'string') {
                    field.basisTable = modelDefinition.basisTable.name;
                    field.stepCount = 0;
                    if (field.step) {
                        var step = _.find(modelDefinition.steps, function (step) {
                            if (step.name == field.step) {
                                return step;
                            }
                        });
                        //field.basisTable = step.join.table.name;
                        field.stepCount = step.stepCount;
                    }

                    var basisColumn = _.find(tables[field.basisTable].columns, function (column) {
                        if (column.name === field.basisColumn) {
                            return column;
                        }
                    });
                    if (basisColumn === undefined) {
                        throw Error('Could not find column');
                    }
                    field.basisColumn = basisColumn;
                }
            });
        }

        return todo;
    }

    return new BluebirdPromise(function (resolve, reject) {
        var todo = parseAndCompile(modelDefinition);
        if (todo.length > 0) {
            BluebirdPromise.all(todo)
                .then(function () {
                    return compile(modelDefinition)
                        .then(resolve);
                })
                .catch(reject);
        } else {
            logger.info('Done');
            return resolve(modelDefinition);
        }
        logger.info('build promise');
    });
}

exports.compile = compile;
