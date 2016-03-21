/**
 * Leverages Grunt-contrib-clean to wipe out various folders
 * @link https://github.com/gruntjs/grunt-contrib-clean
 */
module.exports = {
    dist:{
        files:[{
            dot: true,
            src: '<%= project.dist %>'
        },
        {
            dot: true,
            src: '<%= project.temp %>'
        }]
    }
};