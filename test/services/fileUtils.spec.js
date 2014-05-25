'use strict';

var config = require('../config');
var service = require('../' + config.appRoot + 'app/services/fileUtils');

describe('File Utils Service', function () {
    // TODO Mock the node fs utility so we're not actually hitting the filesystem
    it.skip('should find page in dir', function (done) {
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
