'use strict';

var logger = require('../logger/default').main,
    _ = require('lodash'),
    pageService = require('./pageService'),
    BluebirdPromise = require('bluebird');

var tables = {};

function compile(modelDefinition) {
    var ARTIFACT = pageService.ARTIFACT; // Easy alias

    logger.info('Starting compile', modelDefinition.name);

    function parseAndCompile(modelDefinition) {
        logger.info('Running parseAndCompile');
        console.log(modelDefinition);
        var todo = [];

        if (!modelDefinition.basisTable) {
            throw Error('basisTable is required');
        }
        if (typeof modelDefinition.basisTable === 'string') {
            logger.info('Building basisTable');
            if (modelDefinition.basisTable in tables) {
                var tableDefinition = tables[modelDefinition.basisTable];
                modelDefinition.basisTable = {
                    name: tableDefinition.name,
                    dbName: tableDefinition.dbName
                };
            } else {
                console.info(ARTIFACT);
                todo.push(pageService.getDefinition(ARTIFACT.TABLE, modelDefinition.basisTable)
                    .then(function (tableDefinition) {
                        tables[tableDefinition.name] = tableDefinition;
                    }));
            }
        }

        var stepCount = 0;
        logger.info('Building steps');
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

                    if (!join) {
                        logger.debug(join);
                        throw Error('Failed to find join ' + step.join + ' in ' + JSON.stringify(fromTable.joins));
                    }

                    if (join.table in tables) {
                        var toTable = tables[join.table];
                        step.join = {
                            name: step.join,
                            table: {
                                name: toTable.name,
                                dbName: toTable.dbName
                            }
                        };

                        step.join.columns = _.map(join.columns, function (onClause) {
                            if (onClause.from) {
                                var fromColumn = _.find(fromTable.columns, function (column) {
                                    if (column.name === onClause.from) {
                                        return column;
                                    }
                                });
                                if (!fromColumn) {
                                    throw Error('Failed to find from join column ' + onClause.from
                                    + ' in table ' + fromTable.name);
                                }
                            } else {
                                // TODO Implement fromText
                                throw Error('from in join clause is missing...fromText not supported yet');
                            }
                            var toColumn = _.find(toTable.columns, function (column) {
                                if (column.name === onClause.to) {
                                    return column;
                                }
                            });
                            if (!toColumn) {
                                throw Error('Failed to find to join column ' + onClause.to
                                + ' in table ' + fromTable.name);
                            }
                            return {
                                from: fromColumn,
                                to: toColumn
                            };
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
            logger.info('Building fields');
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
                        console.log(step);
                        field.basisTable = step.join.table.name;
                        field.stepCount = step.stepCount;
                    }

                    var basisColumn = _.find(tables[field.basisTable].columns, function (column) {
                        if (column.name === field.basisColumn) {
                            return column;
                        }
                    });
                    if (basisColumn === undefined) {
                        throw Error('Could not find basis column for ' + field.name + ' on ' + modelDefinition.name);
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
            logger.info('BluebirdPromise');
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
