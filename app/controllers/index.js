'use strict';

// Dead Code. Left for reference only as a sample of how we might handle auth

exports.render = function(req, res) {
    var currentUser = req.user ? JSON.stringify(req.user) : 'null';

    // TODO Build Authentication
    if (currentUser === 'null') {
        console.warn('AUTO LOGIN FOR NOW');
        var fakeUser = {
            username: 'trevorallred',
            name: 'Trevor Allred (AUTO)'
        };
        currentUser = JSON.stringify(fakeUser);
    }

    res.render('index', {
        user: currentUser
    });
};
