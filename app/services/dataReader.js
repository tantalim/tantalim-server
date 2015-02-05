'use strict';

var _ = require('lodash'),
    BluebirdPromise = require('bluebird'),
    async = require('async'),
    logger = require('../logger/default').main,
    knex = require('knex').knex,
    filter = require('./filter');

/**
 * This function is designed to be a hook for future data manipulation when the data from the database needs to be
 * transformed before returning to the client. Custom modifications could be added in the future.
 */
function postQueryDataConversion(parent_rows, modelDefinition) {
    logger.debug('postQueryDataConversion');
    return _.map(parent_rows, function (row) {
        _.forEach(modelDefinition.fields, function (field) {
            if (field.dataType === 'Boolean') {
                row[field.name] = !(!row[field.name]);
            }
        });
        return row;
    });
}

function convertModelToKnexSql(model) {
    logger.debug('convertModelToKnexSql');

    var sql = knex(model.basisTable.dbName + ' as t0');

    if (_.isArray(model.steps)) {
        logger.debug('steps');
        _.forEach(model.steps, function (step) {

            var joinType = step.required ? '' : 'left';

            var tableSyntax = step.join.table.dbName + ' as t' + step.stepCount;
            var onClause = function () {
                var onClause_this = this;
                _.forEach(step.join.columns, function (joincolumn) {
                    // TODO we eventually need to support stuff other than equals
                    var operator = '=';
                    var first = 't' + step.stepCount + '.' + joincolumn.to.dbName;

                    var second;
                    if (joincolumn.fromText) {
                        var singleQuote = '\'';
                        // TODO escape fromText here
                        second = knex.raw(singleQuote + joincolumn.fromText + singleQuote);
                    } else {
                        var fromTableAlias = 't0.';
                        // TODO Support previousStepID

                        second = fromTableAlias + joincolumn.from.dbName;
                    }
                    onClause_this.on(first, operator, second);
                });
            };
            sql.join(tableSyntax, onClause, joinType);
        });
    }

    if (_.isArray(model.orderBy)) {
        logger.debug('orderBy');
        _.forEach(model.orderBy, function (orderBy) {
            // Double check that order by is either DESC or ASC.
            // We might consider removing this and just add orderBy since Knex has it's own checking
            var direction = orderBy.direction === 'DESC' ? 'DESC' : '';
            sql.orderBy(orderBy.fieldName, direction);
        });
    }

    var fields = _.map(model.fields, function (field) {
        return 't' + field.stepCount + '.' + field.basisColumn.dbName + ' AS ' + field.name;
    });
    logger.debug('adding fields');
    sql.select(fields);

    return sql;
}

function addKeysToData(data, instanceID, foreignKeyName) {
    logger.debug('starting addKeysToData');

    return _.map(data, function (row) {
        var newRow = {
            data: row
        };
        if (instanceID && row[instanceID]) {
            newRow.id = row[instanceID];
        }
        if (foreignKeyName && row[foreignKeyName]) {
            newRow.foreignKey = row[foreignKeyName];
        }
        return newRow;
    });
}

function addChildrenToParent(parents, childModel, children) {
    var modelName = childModel.name;
    logger.debug('starting addChildrenToParent from ' + modelName);
    _.forEach(parents, function (parent) {
        if (parent.children === undefined) {
            parent.children = {};
        }

        var foreignKey = _.isArray(childModel.foreignKeys) ? childModel.foreignKeys[0] : childModel.foreignKeys;
        if (foreignKey) {
            parent.children[modelName] = _.filter(children, function (child) {
                return parent.data[foreignKey.parentField] === child.data[foreignKey.childField];
            });
        }
    });
}

function queryModelData(model) {
    return new BluebirdPromise(function (resolve, reject) {
        logger.debug('starting queryModelData');
        var sql = convertModelToKnexSql(model);

        if (model.filter) {
            filter.apply(model.filter, sql, model.fields);
        }

        if (model.limit > 0) {
            sql.limit(model.limit);
            if (model.pageNumber > 1) {
                sql.offset(model.limit * (model.pageNumber - 1));
            }
        }

        // Run Query against database
        var rawSql = sql.toSql();
        logger.debug(rawSql);
        sql
            .then(function (rawData) {
                // Process Query Results
                rawData = postQueryDataConversion(rawData, model);
                var results = addKeysToData(rawData, model.instanceID, model.foreignKey);
                //var childRowsWithKeys = exports.addKeysToData(child_rows, nextModel.primaryKey, nextModel.foreignKey);

                // Exit early if possible
                if (_.isEmpty(rawData)) {
                    return resolve(results);
                }
                if (_.isEmpty(model.children)) {
                    return resolve(results);
                }

                // Begin cascading queries for all child models
                async.each(model.children, function (childModel, childModelDone) {

                    function createForeignKeyJoinFilter(childModel, rawData) {
                        var foreignKeys = _.map(childModel.foreignKeys, function (foreignKey) {
                            return foreignKey.childField;
                        });

                        var parentIDs = _.flatten(_.map(rawData, function (parentRow) {
                            return _.map(childModel.foreignKeys, function (foreignKey) {
                                return parentRow[foreignKey.parentField];
                            });
                        }));

                        // TODO support multiple foreign key joins when knex supports them
                        return foreignKeys[0] + ' IN ' + parentIDs;
                    }

                    // TODO support runtime filters on child models
                    // See if we can guess the foreignKeys from the first and last step
                    if (childModel.foreignKeys) {
                        childModel.filter = createForeignKeyJoinFilter(childModel, rawData);
                    }

                    queryModelData(childModel)
                        .then(function (childResults) {
                            addChildrenToParent(results, childModel, childResults);
                            childModelDone();
                        })
                        .catch(function (err) {
                            reject(err);
                        });
                }, function () {
                    // I had an err catch here before but I could never unit test it so I removed it
                    // until I find a case that throws an err inside sync
                    resolve(results);
                });
            })
            .catch(reject);
    });
}

exports.getData = function (modelDefinition, filterString, pageNumber) {
    logger.debug('starting getData');
    return new BluebirdPromise(function (resolve, reject) {
        modelDefinition.filter = filterString;
        modelDefinition.pageNumber = pageNumber;

        queryModelData(modelDefinition)
            .then(resolve)
            .catch(reject);
    });
};
