'use strict';
/* jshint ignore:start */
angular.module('tantalim.common')
    .factory('ModelData', function () {
            return {
                currentModel: '{{page.modelName}}',
                model: {{{json model}}},
                page: {{{json page}}}
            };
    });
/* jshint ignore:end */
