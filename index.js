#!/usr/bin/env node
'use strict';

var hogan = require('hogan.js');
var fs = require('fs');
var path = require('path');
var util = require('util');
var _ = require('lodash');
var gh = require('github-url-to-object');
var execSync = require('sync-exec');
var stripAnsi = require('strip-ansi');

var argv = require('yargs')
  .usage('Usage: pkg-2-readme path/to/package.json > path/to/README.md [-r] [-t=path/to/template.md]')
  .check(function (argv) {
    if (!argv._.length) throw new Error('A path to a valid package.json is required')
    return true
  })
  .option('t', {
    alias: 'template',
    description: 'use specified custom template'
  })
  .option('b', {
    alias: 'badges',
    description: 'disables badges'
  })
  .option('bn', {
    alias: 'nodeico',
    description: 'disables nodeico badge'
  })
  .option('bg', {
    alias: 'github',
    description: 'disables github badges'
  })
  .option('bgs', {
    alias: 'github_stars',
    description: 'disables github stars badge'
  })
  .option('bgf', {
    alias: 'github_forks',
    description: 'disables github forks badge'
  })
  .option('bgi', {
    alias: 'github_issues',
    description: 'disables github issues badge'
  })
  .option('bgl', {
    alias: 'github_license',
    description: 'disables github license badge'
  })
  .option('bt', {
    alias: 'travis',
    description: 'disables travis badge'
  })
  .option('bc', {
    alias: 'coverage',
    description: 'disables coverage badge'
  })
  .help('help')
  .alias('h', 'help')
  .argv;

  // read package.json into pkg object
var pkgPath = path.resolve(process.cwd(), argv._[0]);

try {
  var pkg = require(pkgPath);
} catch (e) {
  console.error('Invalid JSON file: %s', pkgPath);
  process.exit();
}

// read git info from repository specified in package.json
var gitInfo = null;

if(!!pkg.repository) {
  gitInfo = gh(pkg.repository.url || pkg.repository);
  // {
  //   user: 'monkey',
  //   repo: 'business',
  //   branch: 'master',
  //   tarball_url: 'https://api.github.com/repos/monkey/business/tarball/master',
  //   clone_url: 'https://github.com/monkey/business',
  //   https_url: 'https://github.com/monkey/business',
  //   travis_url: 'https://travis-ci.org/monkey/business',
  //   api_url: 'https://api.github.com/repos/monkey/business'
  //   zip_url: 'https://github.com/monkey/business/archive/master.zip'
  // }
}

if(!gitInfo) {
  console.error('`repository.url` or `repository` must be a correct GitHub repository URL');
  process.exit();
}

// prepare templatePath && templateData
var templatePath = path.join(__dirname, 'template.md');

if (argv.template) {
  templatePath = path.resolve(process.cwd(), argv.template);
}

var template = hogan.compile(fs.readFileSync(templatePath).toString());

var templateData = _.clone(pkg);

// author
templateData.author_name = templateData.author;
templateData.author = gitInfo.user;

// badges
templateData.badges = !argv.badges;

if(!!templateData.badges) {
  templateData.add_nodeico = !argv.nodeico;
  templateData.add_github_badges = !argv.github;

  if(!!templateData.add_github_badges) {
    templateData.add_github_stars = !argv.github_stars;
    templateData.add_github_forks = !argv.github_forks;
    templateData.add_github_issues = !argv.github_issues;
    templateData.add_github_license = !argv.github_license;
  }

  templateData.add_travis = !argv.travis;
  templateData.add_coverage = !argv.coverage;
}

// Look for example.js or example.sh in package.json directory
var extensions = ['js', 'sh'];

extensions.forEach(function (language) {
  var exampleFile = path.resolve(path.dirname(argv._[0])) + '/example.' + language;

  if (fs.existsSync(exampleFile)) {
    templateData.usage = {
      language: language,
      content: fs.readFileSync(exampleFile).toString()
    };

    // replace require('./') statement with the package name
    if (language === 'js') {
      templateData.usage.content = templateData.usage.content.replace(
        /require\(['"]?\.\/['"]?\)/,
        util.format('require("%s")', templateData.name)
      )
    };
  }
})

var getDeps = function (deps) {
  return Object.keys(deps).map(function (depname) {
    var dep = require(path.resolve(path.dirname(argv._[0])) + '/node_modules/' + depname + '/package.json');
    dep.repository = 'https://ghub.io/' + depname;
    return dep;
  })
}

if (templateData.dependencies) {
  templateData.depDetails = getDeps(templateData.dependencies);
}

if (templateData.devDependencies) {
  templateData.devDepDetails = getDeps(templateData.devDependencies)
}

process.stdout.write(template.render(templateData));
