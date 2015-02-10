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
            row.data[field.name] = row.tempID;
            return row.tempID;
        case 'CreatedDate':
            return knex.raw('NOW()');
        default:
            return null;
    }
}

function childUpdate(modelDefinition, row) {
    return new BluebirdPromise(function (resolve, reject) {
        logger.debug('starting childUpdate() for ', modelDefinition.name);

        if (!modelDefinition.children) {
            resolve();
        }
        if (!row.children) {
            resolve();
        }
        async.each(modelDefinition.children, function (childModel, resolveEach) {
            var childData = row.children[childModel.name];
            if (childData) {
                exports.save(childModel, childData)
                    .then(function () {
                        resolveEach();
                    }, function (err) {
                        reject(err);
                    });
            } else {
                logger.debug('no data to save for ', childModel.name);
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
        logger.debug('starting insertData() for ', modelDefinition.name);

        var sql = knex(modelDefinition.basisTable.dbName);

        var sqlReadyRow = {};
        _.forEach(modelDefinition.fields, function (field) {
            var sqlReadyValue = row.data[field.name];

            var hardDefault = getColumnHardDefaultOnInsert(field, row);
            sqlReadyValue = hardDefault ? hardDefault : sqlReadyValue;
            if (sqlReadyValue) {
                sqlReadyRow[field.basisColumn.dbName] = sqlReadyValue;
            }
        });

        logger.debug('sqlReadyRow ', sqlReadyRow);
        sql.insert(sqlReadyRow, modelDefinition.instanceID.basisColumn.dbName);
        sqlLogger.verbose(sql.toSql());
        sqlLogger.debug(sql.getBindings());

        sql
            .then(function (insertId) {
                delete row.state;
                if (insertId && insertId.length > 0 && insertId[0] > 0) {
                    logger.debug('updating %s with autoincrement %d', modelDefinition.instanceID.name, insertId[0]);
                    row.id = insertId[0];
                    row.data[modelDefinition.instanceID.name] = row.id;
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
        logger.debug('starting updateData() for ', modelDefinition.name);

        var sql = knex(modelDefinition.basisTable.dbName);

        var sqlReadyRow = (function getSqlReadyRow() {
            function included(field) {
                function isDefinedAndFalse(value) {
                    if (value === undefined) {
                        return false;
                    }
                    return !value;
                }

                if (field.stepCount > 0) {
                    return false;
                }

                if (isDefinedAndFalse(field.updateable)) {
                    return false;
                }

                return true;
            }

            var sqlReadyRow = {};
            _.forEach(modelDefinition.fields, function (field) {
                if (included(field)) {
                    logger.debug('Preparing to save field: ', field);
                    var sqlReadyValue,
                        hardDefault = getColumnHardDefaultOnUpdate(field);
                    if (hardDefault) {
                        sqlReadyValue = hardDefault;
                    } else {
//                    if (field.dataType) {
//                    }
                        sqlReadyValue = row.data[field.name];
                    }

                    if (sqlReadyValue !== undefined) {
                        sqlReadyRow[field.basisColumn.dbName] = sqlReadyValue;
                    }
                }
            });
            logger.debug('built sqlReadyRow ', JSON.stringify(sqlReadyRow));
            return sqlReadyRow;
        })();

        sql
            .update(sqlReadyRow)
            .where(modelDefinition.instanceID.basisColumn.dbName, row.id);
        logger.debug('show update where ' + modelDefinition.instanceID.basisColumn.dbName + ' = ' + row.id);
        sqlLogger.debug(sql.toSql());
        sqlLogger.debug(sql.getBindings());

        logger.debug('Running update');
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
        logger.debug('starting deleteData() for ', modelDefinition.name);

        var sql = knex(modelDefinition.basisTable.dbName);

        sql
            .del()
            .where(modelDefinition.instanceID.basisColumn.dbName, row.id);
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
        logger.debug('starting modelSaver.save() on %s', modelDefinition.name);
//        logger.debug(data);

        if (!modelDefinition.instanceID) {
            throw Error('Cannot insert/update/delete an instance without an instanceID for ' + modelDefinition.name);
        }
        logger.debug(modelDefinition.instanceID);

        async.each(data, function (row, resolveEach) {
            saveSingleRow(modelDefinition, row)
                .then(function () {
                    resolveEach();
                })
                .catch(function (err) {
                    logger.error('failed on saveSingleRow catch');
                    //logger.error(modelDefinition);
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
