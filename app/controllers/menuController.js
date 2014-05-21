'use strict';

var service = require('../services/menuService');

exports.menu = function (req, res) {
    res.json(service.items);
};
