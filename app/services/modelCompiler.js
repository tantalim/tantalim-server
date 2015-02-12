'use strict';

var logger = require('../logger/default').main,
    _ = require('lodash'),
    errors = require('../errors'),
    pageService = require('./pageService'),
    BluebirdPromise = require('bluebird');

var tables = {};

function compile(modelDefinition) {
    var ARTIFACT = pageService.ARTIFACT; // Easy alias

    logger.info('Starting model compile', modelDefinition.name);

    function findField(fields, fieldName) {
        //console.log('Searching for ' + fieldName + ' in ', fields);
        return _.find(fields, function (field) {
            if (fieldName === field.name) {
                return field;
            }
        });
    }

    function mapFields(modelDefinition) {
        if (!modelDefinition.fields) {
            logger.warn('Model had no fields');
            return;
        }

        logger.info('Building ' + modelDefinition.fields.length + 'fields');

        function findColumn(tableName, columnName) {
            return _.find(tables[tableName].columns, function (column) {
                if (column.name === columnName) {
                    return column;
                }
            });
        }

        var basisTableName = modelDefinition.basisTable.name;
        _.forEach(modelDefinition.fields, function (field) {
            if (typeof field.basisColumn === 'string') {
                field.basisTable = basisTableName;
                field.stepCount = 0;
                if (field.step) {
                    var step = _.find(modelDefinition.steps, function (step) {
                        if (step.name === field.step) {
                            return step;
                        }
                    });
                    field.basisTable = step.join.table.name;
                    field.stepCount = step.stepCount;
                }

                var basisColumn = findColumn(field.basisTable, field.basisColumn);
                if (!basisColumn) {
                    throw Error('Could not find basis column for ' + field.name + ' on ' + modelDefinition.name);
                }
                logger.debug('Mapped field: ' + field.name + ' to ' + basisColumn.name);
                field = _.defaults(field, basisColumn, {
                    required: false,
                    label: basisColumn.name
                });
                // Keep this for backwards compatability
                field.basisColumn = basisColumn;
            }
        });

        var primaryKey = findColumn(basisTableName, tables[basisTableName].primaryKey);
        if (primaryKey) {
            var instanceID = _.find(modelDefinition.fields, function (field) {
                if (field.basisColumn && field.basisColumn.name === primaryKey.name) {
                    return field;
                }
            });
            if (instanceID) {
                modelDefinition.instanceID = instanceID;
            } else {
                logger.info('Field matching primaryKey column wasn\'t included in the model: ' + primaryKey.name);
            }
        }


    }

    function buildSteps(modelDefinition, todo) {
        if (_.isEmpty(modelDefinition.steps)) {
            return;
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
                            var fromColumn;
                            if (onClause.from) {
                                fromColumn = _.find(fromTable.columns, function (column) {
                                    if (column.name === onClause.from) {
                                        return column;
                                    }
                                });
                                if (!fromColumn) {
                                    throw Error('Failed to find from join column ' + onClause.from +
                                    ' in table ' + fromTable.name);
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
                                throw Error('Failed to find to join column ' + onClause.to +
                                ' in table ' + fromTable.name);
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
    }

    function parseAndCompile(modelDefinition) {
        logger.info('Running parseAndCompile for ' + modelDefinition.name);
        //logger.debug(modelDefinition);
        var todo = [];

        if (!modelDefinition.basisTable) {
            throw Error('basisTable is required');
        }
        if (typeof modelDefinition.basisTable === 'string') {
            logger.info('Building basisTable ' + modelDefinition.basisTable);
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

        buildSteps(modelDefinition, todo);

        if (modelDefinition.children) {
            logger.info('Parsing children');
            _.forEach(modelDefinition.children, function (child) {
                if (_.isEmpty(child)) {
                    throw Error('Model ' + modelDefinition.name + ' includes an empty child model. Please remove it.');
                }
                var link = child.parentLink;
                if (_.isEmpty(link) || !link.parentField || !link.childField) {
                    throw Error('Child model ' + child.name + ' must define a parentLink');
                }
                if (!findField(modelDefinition.fields, link.parentField)) {
                    throw Error('Parent model ' + modelDefinition.name + ' is missing parentField named ' + link.parentField);
                }
                if (!findField(child.fields, link.childField)) {
                    throw Error('Child model ' + child.name + ' is missing childField named ' + link.childField);
                }
                parseAndCompile(child);
            });
        }

        if (todo.length === 0) {
            mapFields(modelDefinition);
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
                .catch(function(err) {
                    errors.addTrace(err, {
                        method: 'getDefinition',
                        filename: __filename,
                        params: [artifactType, artifactName]
                    });
                    reject(err);
                });
        } else {
            logger.info('Done with modelCompiler ' + modelDefinition.name);
            return resolve(modelDefinition);
        }
        logger.info('built promise for ' + modelDefinition.name);
    });
}

exports.compile = compile;
