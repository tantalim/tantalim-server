'use strict';

var BluebirdPromise = require('bluebird'),
    chai = require('chai');

chai.Should();
chai.use(require('chai-as-promised'));

describe('Sample', function () {

    describe('promises', function () {

        // Two sample methods to test

        function testPromise(id) {
            return new BluebirdPromise(function (resolve, reject) {
                if (id > 3) {
                    reject('higher than 2');
                }
                resolve(id + 1);
            });
        }

        function pageDefinition() {
            function handleReject(reason) {
                console.warn('failure ' + reason);
            }

            var id = 0;
            return testPromise(id)
                .then(function (id) {
                    return testPromise(id)
                        .then(function (id) {
                            return id;
                        })
                        .catch(handleReject);
                })
                .catch(handleReject);
        }

        // Unit tests

        it('should run Promises', function (done) {
            pageDefinition()
                .should.be.fulfilled.then(function (foo) {
                    foo.should.equal(2);
                })
                .should.notify(done);
        });
    });
});
