'use strict';

var _ = require('lodash'),
    express = require('express'),
    helpers = require('view-helpers'),
    compression = require('compression'),
    cookieParser = require('cookie-parser'),
    cookieSession = require('cookie-session'),
    session = require('express-session'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    passport = require('passport'),
    flash = require('connect-flash'),
    morgan = require('morgan');

var path = require('path');
var rootPath = path.normalize(__dirname);

var config;
var setup = function (custom) {
    var defaultConfig = {
        /**
         * The absolute path to the root of this web server
         * TODO - We might need to change this to the tantalum-server root
         */
        serverRoot: rootPath,
        port: 3000,
        environment: process.env.NODE_ENV || 'development',
        sessionSecret: 'OVERRIDE_THIS_HASH_IN_YOUR_CONFIG',
        sessionCollection: 'sessions',
        passportStrategy: null
    };
    config = _.extend(defaultConfig, custom || {});

    var Knex = require('knex');
    Knex.knex = Knex.initialize({
        client: 'mysql',
        connection: {
            host: config.db.server,
            user: config.db.username,
            password: config.db.password,
            database: config.db.database,
            charset: 'utf8'
        },
        pool: {
            max: 10
        }
    });

    if (config.passportStrategy) {
        passport.use(config.passportStrategy);
        passport.serializeUser(function (user, done) {
            done(null, user.id);
        });

        passport.deserializeUser(function (id, done) {
            done(null, {
                id: 'demo',
                displayName: 'Demo User',
                provider: 'tantalim'
            });
        });
    }
};

/**
 *
 * @returns Express App
 */
var start = function () {
    var app = express();

    app.locals = _.extend(app.locals, config.locals || {});

    app.set('showStackError', true);

    // Prettify HTML
    app.locals.pretty = true;
    // cache=memory or swig dies in NODE_ENV=production
    app.locals.cache = 'memory';

    // Using compression needs more load testing to ensure the settings are valid for Tantalim
    // Should be placed before express.static
    // To ensure that all assets and data are compressed (utilize bandwidth)
    app.use(compression({
        filter: function (req, res) {
            return (/json|text|javascript|css/).test(res.getHeader('Content-Type'));
        },
        // Levels are specified in a range of 0 to 9, where-as 0 is
        // no compression and 9 is best compression, but slowest
        level: 9
    }));

    // Only use logger for development environment
    if (config.environment === 'development') {
        app.use(morgan('combined'));
    }

    // Create `ExpressHandlebars` instance with a default layout.
    var exphbs = require('express-handlebars');
    var hbs = exphbs.create({
//        defaultLayout: 'main',
        helpers: require('./app/services/handlebarHelpers'),

        extname: '.html',
        partialsDir: [
            'app/views/partials/',
            'node_modules/tantalim-server/app/views/partials/'
        ]
    });

    // assign the template engine to .html files
    app.engine('html', hbs.engine);
    app.engine('js', hbs.engine);
    // set .html as the default extension
    app.set('view engine', 'html');

    app.enable('view cache');
    app.set('view options', {layout: false});


    // Set views path, template engine and default layout
    app.set('views', config.serverRoot + '/app/views');
//    app.set('partials', config.serverRoot + '/app/views/partials');

    // Enable jsonp
    app.enable('jsonp callback');

    // The cookieParser should be above session
    app.use(cookieParser());

    // Request body parsing middleware should be above methodOverride
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());
    app.use(methodOverride());

    // Express session storage
    app.use(cookieSession({
        key: 'app.sess',
        secret: config.sessionSecret
    }));

    app.use(session({
        cookie: {maxAge: 60000}
    }));
    app.use(flash());

    app.use(passport.initialize());
    app.use(passport.session());

    // Dynamic helpers
//        app.use(helpers('Tantalim'));

    // Routes should be at the last
    require('./app/routes/index')(app);

    // Setting the fav icon and static folder
    //app.use(express.favicon());
    app.use(express.static(config.appRoot + '/public'));

    // Assume "not found" in the error msgs is a 404. this is somewhat
    // silly, but valid, you can do whatever you like, set properties,
    // use instanceof etc.
    app.use(function (err, req, res, next) {
        // Treat as 404
        if (~err.message.indexOf('not found')) return next();

        // Log it
        console.error(err.stack);

        // Error page
        res.status(500).render('500', {
            error: err.stack
        });
    });

    // Assume 404 since no middleware responded
    app.use(function (req, res) {
        res.status(404).render('404', {
            url: req.originalUrl,
            error: 'Not found'
        });
    });

    var server = app.listen(config.port, function () {
        console.log('Tantalim Server running %s on port:%d', config.environment, server.address().port);
    });

    return app;
};

exports.setup = setup;
exports.start = start;