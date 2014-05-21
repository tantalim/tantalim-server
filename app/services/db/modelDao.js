'use strict';

var knex = require('knex').knex;

function getModelByNameSql(modelName, appName) {
    var out = knex('mdl_model AS model')
        .join('db_table as table', 'table.tableID', '=', 'model.tableID', 'left')
        .join('db_database as db', 'db.databaseID', '=', 'table.databaseID', 'left')
        .join('app_module as module', 'module.moduleID', '=', 'model.moduleID', 'left')
        .join('app_application as application', 'application.appID', '=', 'module.appID', 'left')
        .where('model.name', modelName)
        .select('model.modelID', 'table.dbName AS table_dbName', 'db.databaseName');

    if (appName) {
        out.where('application.appCode', appName);
    }
    return out;
}

function getModel(name) {
    var sql = getModelByNameSql(name);
    sql.then();
}

function getFieldsByModelID(modelID) {
    return knex('mdl_field AS field')
        .join('db_column AS col', 'col.columnID', '=', 'field.columnID', 'left')
        .where('field.modelID', modelID)
        .select(
            'field.name as fieldName',
            'field.stepID as fieldStepID',
            'col.name as colName',
            'col.dbName as colSql'
        );
}

function getStepsByModelID(modelID) {
    return knex('mdl_step AS step')
        .join('db_join AS jn', 'jn.joinID', '=', 'step.joinID')
        .where('step.modelID', modelID)
        .select('step.stepID', 'step.previousStepID');
}

function getChildJoinsByModelID(modelID) {
    return knex('mdl_model AS model')
        .where('model.parentID', modelID)
        .select('model.modelID');
}

exports.getModel = getModel;
exports.getModelByNameSql = getModelByNameSql;
exports.getFieldsByModelID = getFieldsByModelID;
exports.getStepsByModelID = getStepsByModelID;
exports.getChildJoinsByModelID = getChildJoinsByModelID;
