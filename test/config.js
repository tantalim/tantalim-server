'use strict';

var config = {
    appRoot: '../',
    knex: function () {
        var Knex = require('knex');
        Knex.knex = Knex.initialize({
            client: 'mysql',
            connection: {}
        });
        return Knex.knex;
    }

};
module.exports = config;
