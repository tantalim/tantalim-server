'use strict';

var _ = require('lodash'),
    BluebirdPromise = require('bluebird'),
    knex = require('knex').knex,
    logger = require('../logger/default').main,
    sqlLogger = require('../logger/default').sql,
    async = require('async');

function getColumnDefault(field) {
    if (field.basisColumn) {
        if (field.basisColumn.columnDefault) {
            return field.basisColumn.columnDefault;
        }
        if (field.basisColumn.default) {
            logger.error('default is deprecated, please use columnDefault');
            logger.error(field);
            return field.basisColumn.default;
        }
    }
    return null;
}

function getColumnHardDefaultOnUpdate(field) {
    switch (getColumnDefault(field)) {
        case 'UpdatedDate':
            return knex.raw('NOW()');
        default:
            return null;
    }
}

function getColumnHardDefaultOnInsert(field, row) {
    var hardDefault = getColumnHardDefaultOnUpdate(field, row);
    if (hardDefault) {
        return hardDefault;
    }

    switch (getColumnDefault(field)) {
        case 'GUID':
            row.data[field.fieldName] = row.tempID;
            return row.tempID;
        case 'CreatedDate':
            return knex.raw('NOW()');
        default:
            return null;
    }
}

function childUpdate(modelDefinition, row) {
    return new BluebirdPromise(function (resolve, reject) {
        logger.debug('starting childUpdate() for ', modelDefinition.data.modelName);

        if (!modelDefinition.children) {
            resolve();
        }
        if (!row.children) {
            resolve();
        }
        async.each(modelDefinition.children, function (childModel, resolveEach) {
            var childData = row.children[childModel.data.modelName];
            if (childData) {
                exports.save(childModel, childData)
                    .then(function () {
                        resolveEach();
                    }, function (err) {
                        reject(err);
                    });
            } else {
                logger.debug('no data to save for ', childModel.data.modelName);
                resolveEach();
            }
        }, function (err) {
            if (err) {
                reject(err);
            }
            resolve();
        });
    });
}

function insertData(modelDefinition, row) {
    return new BluebirdPromise(function (resolve, reject) {
        logger.debug('starting insertData() for ', modelDefinition.data.modelName);

        var primaryKey = modelDefinition.basisTable.primaryKey;
        var sql = knex(modelDefinition.basisTable.dbName);

        var sqlReadyRow = {};
        _.forEach(modelDefinition.fields, function (field) {
            var sqlReadyValue = row.data[field.fieldName];

            var hardDefault = getColumnHardDefaultOnInsert(field, row);
            sqlReadyValue = hardDefault ? hardDefault : sqlReadyValue;
            if (sqlReadyValue) {
                sqlReadyRow[field.basisColumn.dbName] = sqlReadyValue;
            }
        });

        sql.insert(sqlReadyRow, primaryKey.dbName);
        sqlLogger.verbose(sql.toSql());
        sqlLogger.debug(sql.getBindings());

        sql
            .then(function (insertId) {
                delete row.state;
                if (insertId && insertId.length > 0 && insertId[0] > 0) {
                    logger.debug('updating %s with autoincrement ', modelDefinition.primaryKey.fieldName, insertId[0]);
                    row.id = insertId[0];
                    row.data[modelDefinition.primaryKey.fieldName] = row.id;
                } else {
                    row.id = row.tempID;
                }
                resolve();
            }, function (err) {
                reject(err);
            });
    });
}

function updateData(modelDefinition, row) {
    return new BluebirdPromise(function (resolve, reject) {
        logger.debug('starting updateData() for ', modelDefinition.data.modelName);

        function included(field) {
            logger.debug(field);
            function isDefinedAndFalse(value) {
                if (value === undefined) {
                    return false;
                }
                return !value;
            }

            if (field.fieldStepID) {
                // TODO decide between fieldStep and fieldStepID
                logger.warn('field should use fieldStep, not fieldStepID', field);
                return false;
            }

            if (field.fieldStep) {
                return false;
            }

            if (isDefinedAndFalse(field.updateable)) {
                return false;
            }

            return true;
        }

        var primaryKey = modelDefinition.basisTable.primaryKey;
        var sql = knex(modelDefinition.basisTable.dbName);

        if (!primaryKey) {
            logger.error('failed to find basisTable.primaryKey');
        }
        var sqlReadyRow = {};

        _.forEach(modelDefinition.fields, function (field) {
            if (included(field)) {
                var sqlReadyValue,
                    hardDefault = getColumnHardDefaultOnUpdate(field);
                if (hardDefault) {
                    sqlReadyValue = hardDefault;
                } else {
//                    if (field.dataType) {
//                    }
                    sqlReadyValue = row.data[field.fieldName];
                }

                if (sqlReadyValue !== undefined) {
                    sqlReadyRow[field.basisColumn.dbName] = sqlReadyValue;
                }
            }
        });
        logger.debug('built sqlReadyRow ', sqlReadyRow);

        sql
            .update(sqlReadyRow)
            .where(primaryKey.dbName, row.id);
        sqlLogger.verbose(sql.toSql());
        sqlLogger.debug(sql.getBindings());

        sql
            .then(function () {
                delete row.state;
                childUpdate(modelDefinition, row)
                    .then(function () {
                        resolve();
                    }, function (err) {
                        reject(err);
                    });
            }, function (err) {
                reject(err);
            });
    });
}

function deleteData(modelDefinition, row) {
    return new BluebirdPromise(function (resolve, reject) {
        logger.debug('starting deleteData() for ', modelDefinition.data.modelName);

        var primaryKey = modelDefinition.basisTable.primaryKey;
        var sql = knex(modelDefinition.basisTable.dbName);

        sql
            .del()
            .where(primaryKey.dbName, row.id);
        sqlLogger.verbose(sql.toSql());
        sqlLogger.debug(sql.getBindings());

        sql
            .then(function (deleteCount) {
                if (deleteCount !== 1) {
                    sqlLogger.error(sql.toSql());
                    var err = new Error('Failed to find one unique record to delete but found ' + deleteCount);
                    reject(err);
                    return;
                }
                delete row.state;
                resolve();
            }, function (err) {
                reject(err);
            });
    });
}

function saveSingleRow(modelDefinition, row) {
    switch (row.state) {
        case 'DELETED':
            return deleteData(modelDefinition, row);
        case 'INSERTED':
            return insertData(modelDefinition, row);
        case 'UPDATED':
            return updateData(modelDefinition, row);
        default:
            return childUpdate(modelDefinition, row);
    }
}

exports.save = function (modelDefinition, data) {
    return new BluebirdPromise(function (resolve, reject) {
        logger.debug('starting modelSaver.save() on %s', modelDefinition.data.modelName);
//        logger.debug(data);

        async.each(data, function (row, resolveEach) {
            saveSingleRow(modelDefinition, row)
                .then(function () {
                    resolveEach();
                })
                .catch(function (err) {
                    logger.error('failed on saveSingleRow catch');
                    logger.error(modelDefinition);
                    logger.error(row);
                    resolveEach(err);
                });
        }, function (err) {
            if (err) {
                logger.error('failed on save async each resolveEach');
                reject(err);
            }
            resolve(data);
        });
    });
};
