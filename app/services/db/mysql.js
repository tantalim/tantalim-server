'use strict';

// Just testing require files
var config = require('../../../config/config');
var Knex = require('knex');
Knex.knex = Knex.initialize({
    client: 'mysql',
    connection: {
        host     : config.db.server,
        user     : config.db.username,
        password : config.db.password,
        database : config.db.database,
        charset  : 'utf8'
    },
    pool: {
        max: 10
    }
});
