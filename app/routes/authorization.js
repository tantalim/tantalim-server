'use strict';

/**
 * Generic require login routing middleware
 */
exports.requiresLogin = function (req, res, next) {
    // Don't bother with authorization yet
//    if (!req.isAuthenticated()) {
//        return res.send(401, 'User is not authorized');
//    }
    next();
};