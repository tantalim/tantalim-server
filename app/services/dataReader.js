'use strict';

var _ = require('lodash'),
    BluebirdPromise = require('bluebird'),
    async = require('async'),
    logger = require('../logger/default').main,
    knex = require('knex').knex;

var getTableAlias = function (stepCounter, stepID) {
    if (stepID && stepCounter[stepID])
        return 't' + stepCounter[stepID] + '.';
    return 't0.';
};

/**
 * This function is designed to be a hook for future data manipulation when the data from the database needs to be
 * transformed before returning to the client. Custom modifications could be added in the future.
 */
function postQueryDataConversion(parent_rows, modelDefinition) {
    logger.debug('postQueryDataConversion');
    return _.map(parent_rows, function (row) {
        _.forEach(modelDefinition.fields, function (field) {
            if (field.dataType === 'Boolean') {
                row[field.fieldName] = !(!row[field.fieldName]);
            }
        });
        return row;
    });
}

var Field = function (json, model) {
    var self = this;
    self.json = json;
    self.model = model;

    self.toSql = function () {
        if (!self.json || !self.json.basisColumn) {
            return 'null';
        }
        return getTableAlias(self.model.stepCounter, self.json.fieldStepID) + self.json.basisColumn.dbName;
    };

    self.toSqlAsName = function () {
        return self.toSql() + ' AS ' + self.json.fieldName;
    };
};

function convertModelToKnexSql(model) {
    var sql = knex(model.basisTable.dbName + ' as t0');

    if (_.isArray(model.orderBy)) {
        _.forEach(model.orderBy, function (orderBy) {
            // Double check that order by is either DESC or ASC.
            // We might consider removing this and just add orderBy since Knex has it's own checking
            var direction = orderBy.direction === 'DESC' ? 'DESC' : '';
            sql.orderBy(orderBy.fieldName, direction);
        });
    }

    if (_.isArray(model.steps)) {
        (function () {
            var stepCounter = 1;
            model.stepCounter = {};

            _.forEach(model.steps, function (step) {
                step.stepCount = stepCounter++;
                model.stepCounter[step.stepStepID] = step.stepCount;
            });
        })();

        _.forEach(model.steps, function (step) {
            var joinType = step.joinRequired ? '' : 'left';
            var tableSyntax = step.joinToTableSql + ' as t' + step.stepCount;
            var onClause = function () {
                var onClause_this = this;
                _.forEach(step.joinColumns, function (joincolumn) {
                    // TODO we eventually need to support stuff other than equals
                    var operator = '=';

                    var toTableAlias = getTableAlias(model.stepCounter, step.stepStepID);
                    var first = toTableAlias + joincolumn.toColSql;

                    var second;
                    if (joincolumn.fromText) {
                        var singleQuote = '\'';
                        second = knex.raw(singleQuote + joincolumn.fromText + singleQuote);
                    } else {
                        var fromTableAlias = getTableAlias(model.stepCounter, step.stepPreviousStepID);
                        second = fromTableAlias + joincolumn.fromColSql;
                    }
                    onClause_this.on(first, operator, second);
                });
            };
            sql.join(tableSyntax, onClause, joinType);
        });
    }

    var fields = _.map(model.fields, function (json) {
        return (new Field(json, model)).toSqlAsName();
    });
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

function addChildrenToParent(parents, childName, children) {
    logger.debug('starting addChildrenToParent');
    _.forEach(parents, function (parent) {
        if (parent.children === undefined) {
            parent.children = {};
        }
        parent.children[childName] = _.filter(children, function (child) {
            return parent.id === child.foreignKey;
        });
    });
}

var FilterComparator = {
    EQUALS: '=',
    LIKE: 'like',
    IN: 'in',
    GREATER_THAN: '>'
};

var FilterComparison = function (left, comparator, right) {
    var self = this;

    self.left = left;
    self.comparator = comparator || FilterComparator.EQUALS;
    self.right = right;
    self.isValid = function() {
        return self.left && self.right;
    };
};

var FilterJoin = {
    AND: 'and',
    OR: 'or'
};

var Filter = function (model) {
    // Initialize defaults
    var self = this;
    self.clauses = [];
    self.joiner = FilterJoin.AND;

    self.add = function(value) {
        if (value instanceof FilterComparison) {
            self.clauses.push(value);
        }
    };

    if (model instanceof FilterComparison) {
        self.add(model);
    } else {
        self.model = model;
    }

    self.addAdvancedWhereClause = function (advancedWhereClauses) {
        if (_.isEmpty(advancedWhereClauses)) {
            return;
        }
        console.error('Adding ' + advancedWhereClauses);
    };

    self.addDefaultFilter = function (filterValue) {
        if (_.isEmpty(filterValue)) {
            return;
        }

        if (_.isEmpty(self.model.defaultFilter)) {
            throw 'default filter value is used but no default filter is defined';
        }

        var defaultField = new Field(self.model.defaultFilter, model);

        var filterComparison = new FilterComparison();
        filterComparison.left = defaultField.toSql();
        filterComparison.right = filterValue;
        self.clauses.push(filterComparison);
    };
};

function queryModelData(model) {
    return new BluebirdPromise(function (resolve, reject) {
        var sql = convertModelToKnexSql(model);

        if (model.filter) {
            // Add Filters to Knex Where Clause
            _.forEach(model.filter.clauses, function (filterComparison) {
                logger.debug('Adding filter comparison to knex.where');
                logger.debug(filterComparison);
                if (filterComparison.isValid()) {
                    if (filterComparison.comparator === FilterComparator.IN) {
                        sql.whereIn(filterComparison.left, filterComparison.right);
                    } else {
                        sql.where(filterComparison.left, filterComparison.comparator, filterComparison.right);
                    }
                }
            });
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
                        var parentIDs = _.flatten(_.map(rawData, function (parentRow) {
                            return _.map(childModel.foreignKeys, function (foreignKey) {
                                return parentRow[foreignKey.parentField];
                            });
                        }));

                        var foreignKeys = _.map(childModel.foreignKeys, function(foreignKey) {
                            var foundField = _.find(childModel.fields, function (field) {
                                if (field.fieldName === foreignKey.childField) {
                                    return field;
                                }
                            });
                            return new Field(foundField, childModel);
                        });

                        // TODO support multiple foreign key joins when knex supports them
                        return new FilterComparison(foreignKeys[0].toSql(), FilterComparator.IN, parentIDs);
                    }

                    childModel.filter = new Filter();
                    // TODO support runtime filters on child models
                    if (childModel.foreignKeys) {
                        childModel.filter.add(createForeignKeyJoinFilter(childModel, rawData));
                    }

                    queryModelData(childModel)
                        .then(function (childResults) {
                            addChildrenToParent(results, childModel.data.modelName, childResults);
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

exports.getData = function (modelDefinition, defaultFilterValue, advancedWhereClauses) {
    return new BluebirdPromise(function (resolve, reject) {
        modelDefinition.filter = new Filter(modelDefinition);
        modelDefinition.filter.addDefaultFilter(defaultFilterValue);
        modelDefinition.filter.addAdvancedWhereClause(advancedWhereClauses);

        queryModelData(modelDefinition)
            .then(resolve)
            .catch(reject);
    });
};
