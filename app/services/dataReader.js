'use strict';

var _ = require('lodash'),
    BluebirdPromise = require('bluebird'),
    async = require('async'),
    logger = require('../logger/default').main,
    knex = require('knex').knex;

exports.getParentFieldByChildStep = function (parentFields, childStep) {
    logger.debug('starting getParentFieldByChildStep', parentFields, childStep);
    if (!childStep) {
        throw new Error('Missing childStep parameter');
    }
    if (childStep.length === 0) {
        throw new Error('Joins must have join columns');
    }
    if (childStep.length > 1) {
        throw new Error('Multi column joins are not supported between models');
    }

    var step = childStep[0];

    var matchingField = _.find(parentFields, function (field) {
        return (!field.fieldStepID && field.basisColumn && field.basisColumn.dbName === step.toColSql);
    });

    if (matchingField && matchingField.fieldName)
        return matchingField.fieldName;

    throw new Error('Could not find field with sql = ' + step.toColSql);
};

exports.addKeysToData = function (data, primaryKey, foreignKey) {
    logger.debug('starting addKeysToData');
    var results = [];

    _.forEach(data, function (row) {
        var newRow = {
            data: row
        };
        if (primaryKey) {
            newRow.id = row[primaryKey.fieldName];
            if (!newRow.id) {
                logger.warn('failed to add PK ', primaryKey, row);
            }
        }
        if (foreignKey) {
            newRow.foreignKey = row[foreignKey];
            if (!newRow.foreignKey) {
                logger.warn('failed to add FK ', foreignKey, row);
            }
        }
        results.push(newRow);
    });

    return results;
};

exports.addChildrenToParent = function (parents, childName, children) {
    logger.debug('starting addChildrenToParent');
    _.forEach(parents, function (parent) {
        if (parent.children === undefined) {
            parent.children = {};
        }
        parent.children[childName] = _.filter(children, function (child) {
            return parent.id === child.foreignKey;
        });
    });
};

var joinLookup = {};

var getTableAlias = function (stepID) {
    if (stepID && joinLookup[stepID])
        return 't' + joinLookup[stepID] + '.';
    return 't0.';
};

exports.getModelSql = function (md, parentModel, parentData) {
    logger.debug('starting getModelSql');
    if (_.isArray(md)) {
        md = md[0];
    }

    (function () {
        var stepCounter = 1;
        _.forEach(md.steps, function (step) {
            step.stepCount = stepCounter++;
            joinLookup[step.stepStepID] = step.stepCount;
        });
    })();

    var fields = [];
    _.forEach(md.fields, function (field) {
        logger.debug('adding field %s', field.fieldName);
        if (field.basisColumn) {
            fields.push(getTableAlias(field.fieldStepID) + field.basisColumn.dbName + ' AS ' + field.fieldName);
        }
    });

    if (!md.basisTable) {
        throw new Error('Basis Table is not defined for model');
    }
    logger.debug('adding sql for table', md.basisTable);
    var sql = knex(md.basisTable.dbName + ' as t0');
    _.forEach(md.steps, function (step) {
        var joinType = step.joinRequired === '1' ? '' : 'left';
        var tableSyntax = step.joinToTableSql + ' as t' + step.stepCount;
        var onClause = function () {
            var onClause_this = this;
            _.forEach(step.joinColumns, function (joincolumn) {
                // TODO we eventually need to support stuff other than equals
                var operator = '=';

                var toTableAlias = getTableAlias(step.stepStepID);
                var first = toTableAlias + joincolumn.toColSql;

                var second;
                if (joincolumn.fromText) {
                    var singleQuote = '\'';
                    second = knex.raw(singleQuote + joincolumn.fromText + singleQuote);
                } else {
                    var fromTableAlias = getTableAlias(step.stepPreviousStepID);
                    second = fromTableAlias + joincolumn.fromColSql;
                }
                onClause_this.on(first, operator, second);
            });
        };
        sql.join(tableSyntax, onClause, joinType);
    });

    if (parentData) {
        var childStep = _.find(md.steps, function (step) {
            return md.data.parent_stepID === step.stepStepID;
        });

        if (!childStep) {
            var err = 'Could not find valid stepID ';
            try {
                console.debug(md.data);
                err += md.data.parent_stepID + ' to link child ' + md.data.modelName + ' to parent';
            } finally {
                throw err;
            }
        }

        var parentPrimaryKeyAkaToColumn = exports.getParentFieldByChildStep(parentModel.fields, childStep.joinColumns);

        var parentIDs = [];
        _.forEach(parentData, function (parentRow) {
            parentIDs.push(parentRow[parentPrimaryKeyAkaToColumn]);
        });

        var foreignKeySql = 't' + childStep.stepCount +
            '.' + childStep.joinColumns[0].toColSql;
        sql.whereIn(foreignKeySql, parentIDs);
    }
    sql.select(fields);

    if (md.orderBy && md.orderBy.length > 0) {
        _.forEach(md.orderBy, function (orderBy) {
            var direction = orderBy.direction === 'DESC' ? 'DESC' : 'ASC';
            sql.orderBy(orderBy.fieldName, direction);
        });
    }

    logger.debug(sql.toSql());
    return sql;
};

function getFieldSql(field) {
    return getTableAlias(field.fieldStepID) + field.basisColumn.dbName;
}

function addDefaultFilter(sql, modelDefinition, filterValue) {
    if (_.isEmpty(filterValue)) {
        return;
    }

    if (!modelDefinition.defaultFilter) {
        throw 'default filter value is used but no default filter is defined in Model: ' + modelDefinition;
    }

    var primaryFilterField = getFieldSql(modelDefinition.defaultFilter);
    // TODO Test SQL Injection here
    sql.where(primaryFilterField, '=', filterValue);

    logger.debug('Added runtime filterValue');
    logger.debug(sql.toSql());
}
//exports.addFilter = addDefaultFilter;

function findField(modelDefinition, fieldName) {
    return _.find(modelDefinition.fields, function (field) {
        if (field.fieldName === fieldName) {
            return field;
        }
    });
}

function addAdvancedWhereClauses(sql, modelDefinition, advancedWhereClauses) {
    if (_.isEmpty(advancedWhereClauses)) {
        return;
    }
    _.keys(advancedWhereClauses).forEach(function (fieldName) {
        var field = findField(modelDefinition, fieldName);
        var fieldSql = getFieldSql(field);
        sql.where(fieldSql, '=', advancedWhereClauses[fieldName]);
    });
}

exports.getData = function (modelDefinition, defaultFilterValue, advancedWhereClauses) {
    function postQueryDataConversion(parent_rows, modelDefinition) {
        logger.debug('postQueryDataConversion');
        _.forEach(modelDefinition.fields, function (field) {
            if (field.dataType === 'Boolean') {
                _.forEach(parent_rows, function (row) {
                    row[field.fieldName] = !(!row[field.fieldName]);
                });
            }
        });
    }

    return new BluebirdPromise(function (resolve, reject) {
        logger.debug('starting getData');

        var modelSql = exports.getModelSql(modelDefinition);

        defaultFilterValue = defaultFilterValue ? defaultFilterValue : {};
        logger.debug('defaultFilterValue = ', defaultFilterValue);
        advancedWhereClauses = advancedWhereClauses ? advancedWhereClauses : [];
        logger.debug('advancedWhereClauses = ', advancedWhereClauses);

        addDefaultFilter(modelSql, modelDefinition, defaultFilterValue);
        addAdvancedWhereClauses(modelSql, modelDefinition, advancedWhereClauses);

        modelSql
            .then(function (parent_rows) {
                postQueryDataConversion(parent_rows, modelDefinition);
                var parentRowsWithKeys = exports.addKeysToData(parent_rows, modelDefinition.primaryKey);
                if (modelDefinition.children && modelDefinition.children.length > 0) {
                    var readChildModel = function (nextModel, childModelDone) {
                        if (!nextModel.data) {
                            resolve(parentRowsWithKeys);
                        }
                        var sqlColumns;
                        try {
                            sqlColumns = exports.getModelSql(nextModel, modelDefinition, parent_rows);
                        } catch (err) {
                            logger.error('failed to get sql for child model');
                            reject(err);
                            return;
                        }
                        sqlColumns.then(function (child_rows) {
                            postQueryDataConversion(child_rows, nextModel);
                            var childRowsWithKeys = exports.addKeysToData(child_rows, nextModel.primaryKey, nextModel.foreignKey);
                            exports.addChildrenToParent(parentRowsWithKeys, nextModel.data.modelName, childRowsWithKeys);
                            childModelDone();
                        }, function (err) {
                            logger.error('failed to read data 2', err);
                            reject(err);
                            return;
                        });
                    };
                    async.each(modelDefinition.children, readChildModel, function (err) {
                        if (err) {
                            logger.error('failed to read data 3', err);
                            reject(err);
                            return;
                        }
                        resolve(parentRowsWithKeys);
                    });
                } else {
                    resolve(parentRowsWithKeys);
                }
            })
            .catch(function (err) {
                reject(err);
            });

    });
};
