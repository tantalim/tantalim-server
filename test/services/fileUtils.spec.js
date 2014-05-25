'use strict';

var config = require('../config');
var service = require('../' + config.appRoot + 'app/services/fileUtils');
var should = require('should');

describe('File Utils Service', function () {
    it('should find page in dir', function (done) {
        service.getListByTypeAndName('pages', 'TestUnit').should.eventually.eql([
            {
                storageType: 'FILE',
                organization: 'tantalim',
                module: 'test',
                rawFilePath: './tantalim_modules/tantalim/test/pages/TestUnit.json',
                name: 'TestUnit.json',
                extension: 'json',
                type: 'pages'
            }
        ]).notify(done);
    });
});
