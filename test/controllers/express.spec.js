'use strict';

var config = require('../config'),
    request = require('supertest');

describe('Express App', function () {

    it('GET model_data', function (done) {
        // TODO - this isn't a unit test since it connects to DB
        request(config.app)
            .get('/data/ListTables')
            .set('Accept', 'application/json')
            .expect('Content-Type', 'application/json; charset=utf-8')
            .expect(200, done);
    })
});
