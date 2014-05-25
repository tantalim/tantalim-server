'use strict';

module.exports = function (grunt) {
    // Project Configuration
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        watch: {
            js: {
                files: ['gruntfile.js', 'server.js', 'app/**/*.js',
                    'public/js/common/**/*.js',
                    'public/js/mobile/**/*.js',
                    'public/js/page/**/*.js',
                    '../test/**/*.js'],
                tasks: ['concat'],
                options: {
                    livereload: true
                }
            },
            mocha: {
                files: ['app/**/*.js', 'test/**/*.js'],
                options: {
                    livereload: true
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
        concurrent: {
            tasks: ['mochaTest', 'watch'],
            options: {
                logConcurrentOutput: true
            }
        },
        mochaTest: {
            options: {
                reporter: 'spec', //'spec', 'dot',
                require: [
//                    '../../../src/main',
                ]
            },
            src: ['test/mocha/**/*.js']
        }
    });

    //Load NPM tasks
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-concurrent');
//    grunt.loadNpmTasks('grunt-env');

    //Default task(s).
    grunt.registerTask('default', ['concurrent']);
    grunt.registerTask('concurrent', ['mochaTest','jshint']);
};
