'use strict';

var knex = require('knex').knex;

function getPageSql(name) {
    var out = knex('ui_page AS page')
        .where('page.name', name)
        .select('page.pageID', 'page.name');
    return out;
}

exports.getPageSql = getPageSql;