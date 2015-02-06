'use strict';
var service = require('./pageService'),
    logger = require('../logger/default').main;

exports.buildMenuItems = function (user) {
    var menuName = 'Default';
    if (user) {
        // TODO create logic to allow for other menus based on current user
        logger.debug('Currently logged in user = ', user);
    }

    return service.getDefinition(service.ARTIFACT.MENU, menuName)
        .then(function (content) {
            logger.info(content);
            return content;
        });
};
