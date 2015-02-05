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
    logger.debug('starting convertModelToKnexSql for ' + model.name);
    //logger.debug(JSON.stringify(model));

    var sql = knex(model.basisTable.dbName + ' as t0');

    if (_.isArray(model.steps)) {
        logger.debug('parsing steps');
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
        logger.debug('adding orderBy clause');
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
    logger.debug('starting addKeysToData for ' + data.length + ' rows where instanceID = ' + JSON.stringify(instanceID) +
    ' and foreignKey = ' + JSON.stringify(foreignKeyName));

    var instanceIdName = (function () {
        if (!instanceID) return undefined;
        if (typeof instanceID === 'string') return instanceID;
        return instanceID.name;
    })();

    return _.map(data, function (row) {
        var newRow = {
            data: row
        };
        if (instanceIdName && row[instanceIdName]) {
            newRow.id = row[instanceIdName];
        }
        if (foreignKeyName && row[foreignKeyName]) {
            newRow.foreignKey = row[foreignKeyName];
        }
        return newRow;
    });
}

function addChildrenToParent(parents, childModel, children) {
    var modelName = childModel.name;
    logger.debug('mapping ' + children.length + ' rows from ' + modelName + ' to parent model');

    _.forEach(parents, function (parent) {
        if (parent.children === undefined) {
            parent.children = {};
        }

        var parentLink = childModel.parentLink;
        if (parentLink) {
            var twoGroups = _.partition(children, function (child) {
                return parent.data[parentLink.parentField] === child.data[parentLink.childField];
            });
            parent.children[modelName] = twoGroups[0];
            children = twoGroups[1];
        }
    });
    if (children.length > 0) {
        logger.warn('failed to map ' + children.length + ' children rows ');
    }
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

                    var parentIDs = _.flatten(_.map(rawData, function (parentRow) {
                        return parentRow[childModel.parentLink.parentField];
                    }));
                    childModel.filter = childModel.parentLink.childField + ' IN ' + parentIDs;

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
