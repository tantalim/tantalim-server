'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    helper = require(configAppRoot + 'services/handlebarHelpers'),
    chai = require('chai');

chai.should();

describe('Handlebar Helpers', function () {
    it('should set angular variable', function () {
        helper.ngVar('test').should.eql('{{test}}');
    });

    describe('Handlebar Helpers', function () {
        var context = {
            fn: function() {
                return 'foo';
            }
        };
        it('should print undefined text', function () {
            helper.fieldType(undefined, 'text', context).should.eql('foo');
        });
        it('should print text text', function () {
            helper.fieldType('text', 'text', context).should.eql('foo');
        });
        it('should not print undefined checkbox', function () {
            helper.fieldType(undefined, 'checkbox', context).should.eql('');
        });
        it('should not print text checkbox', function () {
            helper.fieldType('text', 'checkbox', context).should.eql('');
        });
    });
});
