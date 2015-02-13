'use strict';

var service = require('../services/sourceEtlService');

exports.exportAll = function (req, res) {
    return res.jsonp({});
};

exports.importAll = function (req, res) {
    service.importArtifact()
        .then(function (data) {
            return res.jsonp(data);
        })
        .catch(function (err) {
            return res.jsonp({error: err.toString()});
        });
};

