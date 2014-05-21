'use strict';

angular.module('tantalim.common')
    .factory('ModelData', function () {
        return {
            error: '{{code}}',
            message: '{{message}}'
        };
    });
