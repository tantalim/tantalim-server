'use strict';

var config = require('../config'),
    filter = require('../' + config.appRoot + 'app/services/filter');

describe.only('Filter', function () {
    it('should do something', function () {
        filter.parse('TableName = "foo"');
    });
});
