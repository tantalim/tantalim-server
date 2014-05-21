'use strict';

var getSearchByName = function (pageName, callback) {
    try {
        var page = require('../temp/search_' + pageName);
        callback(page.page, null);
        return;
    } catch (e) {
    }
    callback(null, new Error('Could not find UI for ' + pageName));
};
exports.getSearchByName = getSearchByName;
