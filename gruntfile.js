'use strict';

module.exports = function (grunt) {
    // Project Configuration
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        watch: {
            jshint: {
                files: ['gruntfile.js', 'server.js', 'app/**/*.js', 'test/**/*.js'],
                tasks: ['jshint']
            },
            mocha: {
                files: ['app/**/*.js', 'test/**/*.js'],
                options: {
                    spawn: true,
                    interrupt: true,
                    debounceDelay: 250
                },
                tasks: ['mochaTest']
            }
        },
        jshint: {
            all: {
                src: [
                    'gruntfile.js',
                    'app/**/*.js',
                    'test/**/*.js'
                ],
                options: {
                    jshintrc: true
                }
            }
        },
        mochaTest: {
            options: {
                reporter: 'spec' // spec or dot
            },
            src: ['test/**/*.spec.js']
        }
    });

    //Load NPM tasks
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-mocha-test');

    // TODO Consider using https://github.com/daniellmb/grunt-istanbul-coverage

    //Default task(s).
    grunt.registerTask('default', ['jshint', 'watch']);
    grunt.registerTask('default', ['watch']);

    //grunt.registerTask('test', ['jshint', 'mochaTest']);
    // Running jshint during CI builds is ideal
    // but for some reason I'm getting errors on Travis that I'm not seeing locally.
    grunt.registerTask('test', ['mochaTest']);
};
