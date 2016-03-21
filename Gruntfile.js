'use strict';

module.exports = function (grunt) {

    //For list of available tasks see grunt/aliases.yaml
    var path = require('path');

    //Loads task configuration from grunt/*
    require('load-grunt-config')(grunt, {
        data: {
            //data passed into config.  Can use with <%= test %> in configuration files located in grunt/*
            pkg : grunt.file.readJSON('package.json'),
            project: {
                path: path.resolve(),
                root: '',
                app: 'src',
                dist: 'dist',
                temp: '.tmp',
                version: grunt.option('projectVersion') || '<%= pkg.version %>'
            }
        }
    });

    // Time how long tasks take. Can help when optimizing build times
    require('time-grunt')(grunt);

    //Load custom tasks located in grunt/tasks/*
    grunt.loadTasks('grunt/tasks');

};