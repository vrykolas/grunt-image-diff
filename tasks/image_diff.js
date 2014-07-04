/*
 * grunt-image-diff
 * https://github.com/vrykolas/grunt-image-diff
 *
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {
  var async = require('async');
  var Canvas = require('canvas');
  var imagediff = require('imagediff');
  var isArray = require('lodash.isarray');
  var arrayUniq = require('lodash.uniq');
  var path = require('path');

  var longestTargetPathPrefix = '';

  var longestPathPrefix = function (array) {
    if (array.length === 0) {
      return '';
    }

    array = arrayUniq(array);
    if (array.length === 1) {
      return array[0];
    }

    var A = array.slice(0).sort();
    var path1 = A[0].split('/');
    var path2 = A[A.length - 1].split('/');
    var L = path1.length;
    var i = 0;

    while (i < L && path1[i] === path2[i]) {
      i++;
    }
    path1 = path1.slice(0, i);
    return path1.join('/');
  };

  var ensureTrailingSlash = function (string) {
    if (string.substr(-1) !== '/') {
      return string + '/';
    }

    return string;
  };

  var loadImage = function (filepath) {
    var image = new Canvas.Image();

    if (grunt.file.exists(filepath)) {
      image.src = filepath;
    } else {
      image.src = new Canvas(1, 1).toBuffer();
    }

    return imagediff.toImageData(image);
  };

  var compareImages = function (srcImage, targetImage, diffFile, callback) {
    if (imagediff.equal(srcImage, targetImage, 0)) {
      return callback();
    }

    var diffPath = path.dirname(diffFile);

    if (!grunt.file.exists(diffPath)) {
      grunt.file.mkdir(diffPath);
    }
    var differences = imagediff.diff(srcImage, targetImage, {align: 'top'});
    imagediff.imageDataToPNG(differences, diffFile, function (error) {
      if (error) {
        throw error;
      }
      callback();
    });
  };

  var compareFiles = function (srcFiles, targetDir, options, done) {
    async.each(srcFiles, function (srcFile, callback) {
      var targetFile = ensureTrailingSlash(targetDir) + srcFile;
      var diffFile = ensureTrailingSlash(options.diffDir);

      if (longestTargetPathPrefix === '/') {
        diffFile = diffFile + targetFile;
      } else {
        diffFile = diffFile + targetFile.substr(longestTargetPathPrefix.length);
      }
      srcFile = ensureTrailingSlash(options.srcDir) + srcFile;

      var srcImage = loadImage(srcFile);
      var targetImage = loadImage(targetFile);

      compareImages(srcImage, targetImage, diffFile, callback);
    }, function (error) {
      if (error) {
        throw error;
      }
      done();
    });
  };

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('image_diff', 'The best Grunt plugin ever.', function () {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      srcDir: './src',
      targetDir: './target',
      diffDir: './diffs',
      filePattern: '**/*.png'
    });
    var done = this.async();

    var srcFiles = grunt.file.expand({cwd: options.srcDir}, options.filePattern);

    if (isArray(options.targetDir)) {
      longestTargetPathPrefix = ensureTrailingSlash(longestPathPrefix(options.targetDir));
      async.each(options.targetDir, function (targetDir, callback) {
        compareFiles(srcFiles, targetDir, options, callback);
      }, function (error) {
        if (error) {
          throw error;
        }
        done();
      });
    } else {
      longestTargetPathPrefix = ensureTrailingSlash(options.targetDir);
      compareFiles(srcFiles, options.targetDir, options, done);
    }
  });
};
