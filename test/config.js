'use strict';

var config = {
    appRoot: '../'
};
module.exports = config;

//var app = require(config.appRoot + 'main');
//module.exports.app = app;

var Knex = require('knex');
Knex.knex = Knex.initialize({
    client: 'mysql',
    connection: {
        host     : 'FAKE_SERVER',
        user     : 'root',
        password : '',
        database : 'integration_tests',
        charset  : 'utf8'
    }
});
