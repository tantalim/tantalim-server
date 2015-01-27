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
            src: ['test/**/*.js']
        }
    });

    //Load NPM tasks
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-mocha-test');

    //Default task(s).
    grunt.registerTask('default', ['jshint', 'watch']);
    grunt.registerTask('test', ['jshint', 'mochaTest']);
};
