'use strict';

var logger = require('../logger/default').debug,
    _ = require('lodash'),
    pageService = require('./pageService'),
    BluebirdPromise = require('bluebird');

var ARTIFACT = pageService.ARTIFACT;

var tables = {};

function findListOfMissingArtifacts(modelDefinition) {
    var todo = [];
    if (!modelDefinition.basisTable) {
        throw Error('basisTable is required');
    }
    if (typeof modelDefinition.basisTable === 'string') {
        todo.push(pageService.getDefinition(ARTIFACT.TABLE, modelDefinition.basisTable)
            .then(function (tableDefinition) {
                tables[tableDefinition.name] = tableDefinition;
                modelDefinition.basisTable = {
                    name: tableDefinition.name,
                    dbName: tableDefinition.dbName
                };
            }));
    }

    var stepCount = 0;
    _.forEach(modelDefinition.steps, function (step) {
        if (step.join) {
            stepCount++;
            step.stepCount = stepCount;
            steps[step.name] = step;

            console.info(tables[modelDefinition.basisTable]);
            //var join = _.find();

            //todo.push(pageService.getDefinition(ARTIFACT.TABLE, step.join)
            //    .then(function (tableDefinition) {
            //        tables[tableDefinition.name] = tableDefinition;
            //        step.join = {
            //            name: tableDefinition.name,
            //            dbName: tableDefinition.dbName,
            //            columns: [
            //
            //            ]
            //        };
            //    }));
        } else {
            throw Error('Model steps must define a join: ' + step);
        }
    });

    return todo;
}

function isTableReadyToBeReplaced(table) {
    if (table === undefined) {
        return false;
    }
    return typeof table === 'string' && table in tables;
}

function updateDefinitionWithArtifacts(modelDefinition) {
    if (isTableReadyToBeReplaced(modelDefinition.basisTable)) {
        var tableDefinition = tables[modelDefinition.basisTable];
        modelDefinition.basisTable = {
            name: tableDefinition.name,
            dbName: tableDefinition.dbName
        };
    }

    _.forEach(modelDefinition.fields, function (field) {
        console.info(field);
        if (field.basisColumn) {
            field.basisTable = modelDefinition.basisTable.name;
            field.stepCount = 0;
            if (field.step) {
                var step = _.find(modelDefinition.steps, function (step) {
                    //if ()
                });
                console.info(step);
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

function compile(modelDefinition) {
    logger.info('Starting compile', modelDefinition);
    return new BluebirdPromise(function (resolve, reject) {
        var todo = findListOfMissingArtifacts(modelDefinition);
        if (todo.length > 0) {
            BluebirdPromise.all(todo)
                .then(function () {
                    updateDefinitionWithArtifacts(modelDefinition);
                    return compile(modelDefinition)
                        .then(resolve);
                })
                .catch(reject);
        } else {
            return resolve(modelDefinition);
        }
    });
}

exports.compile = compile;
