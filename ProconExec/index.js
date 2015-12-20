'use strict';

const co = require('co');
const pify = require('pify');

const fs = require('fs');
const fsAsync = pify(fs);
const glob = pify(require('glob'));

const path = require('path');
const base = path.basename;
const resolve = path.resolve;
const childProcess = require('child_process');
const spawn = childProcess.spawn;
const exec = childProcess.exec;
const streamString = require('stream-string');

const ROOTDIR = process.env['WORKDIR'] || process.cwd();
const ARGV = Array.from(process.argv).splice(2);
const MODE = ARGV[0];
const LANG = ARGV[1];

const CPU_LIMIT_TIME = parseInt(process.env['CPU_LIMIT_TIME'], 10) || 2;
const MEM_LIMIT_KB = parseInt(process.env['MEM_LIMIT_KB'], 10) || 256 * 1024;

if (MODE === 'build') build();
if (MODE === 'run') run();

function build() {
  let srcPath = resolve(ROOTDIR, './script/script');

  let results = { status: 'IE' };
  co(function*() {
    yield fsAsync.stat(srcPath);

    let cwd = resolve(ROOTDIR, './script');
    let child = exec(buildCommand(LANG, srcPath), { cwd: cwd });
    let exitCode = yield new Promise((resolve) => child.on('close', resolve));

    if (exitCode !== 0) {
      results.status = 'CE';
    } else {
      results.status = 'OK';
    }
    console.log(JSON.stringify(results));
  })
  .catch((err) => {
    console.error(err.stack || err);
    console.log(JSON.stringify({ status: 'IE' }));
  });
}

function buildCommand(lang, scriptPath) {
  let dirPath = path.dirname(scriptPath);
  switch(lang.toLowerCase()) {
    case 'c': {
      let mainScript = resolve(dirPath, 'script.c');
      let distPath = resolve(dirPath, 'runnable');
      return `
        mv ${scriptPath} ${mainScript} &&
        gcc -O2 -lm -o ${distPath} ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'c++': {
      let mainScript = resolve(dirPath, 'script.cpp');
      let distPath = resolve(dirPath, 'runnable');
      return `
        mv ${scriptPath} ${mainScript} &&
        g++ -O2 -lm -o ${distPath} ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'c++11': {
      let mainScript = resolve(dirPath, 'script.cpp');
      let distPath = resolve(dirPath, 'runnable');
      return `
        mv ${scriptPath} ${mainScript} &&
        g++ -O2 -lm -std=gnu++11 -o ${distPath} ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'csharp': {
      let mainScript = resolve(dirPath, 'script.cs');
      let distPath = resolve(dirPath, 'runnable');
      return `
        mv ${scriptPath} ${mainScript} &&
        dmcs -warn:0 /r:System.Numerics.dll /codepage:utf8
        ${mainScript} -out:${distPath}
      `.replace(/\n/g, '');
    }
    case 'haskell': {
      let mainScript = resolve(dirPath, 'script.hs');
      let distPath = resolve(dirPath, 'runnable');
      return `
        mv ${scriptPath} ${mainScript} &&
        ghc -o ${distPath} -O ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'java': {
      let mainScript = resolve(dirPath, 'Main.java');
      return `
        mv ${scriptPath} ${mainScript} &&
        javac -encoding UTF8 ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'python2': {
      let mainScript = resolve(dirPath, 'script.py');
      return `
        mv ${scriptPath} ${mainScript} &&
        python -m py_compile ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'python3': {
      let mainScript = resolve(dirPath, 'script.py');
      return `
        mv ${scriptPath} ${mainScript} &&
        python3 -m py_compile ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'swift': {
      let sourceDir = resolve(dirPath, './Sources');
      let mainScript = resolve(sourceDir, 'main.swift');
      return `
        cd ${dirPath} &&
        touch Package.swift &&
        mkdir -p ${sourceDir} &&
        mv ${scriptPath} ${mainScript} &&
        swift build
      `.replace(/\n/g, '');
    }
    case 'perl': {
      let mainScript = resolve(dirPath, 'script.pl');
      return `
        mv ${scriptPath} ${mainScript} &&
        perl -cw ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'perl6': {
      let mainScript = resolve(dirPath, 'script.pl');
      return `
        mv ${scriptPath} ${mainScript} &&
        perl6 -c ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'php': {
      let mainScript = resolve(dirPath, 'script.php');
      return `
        mv ${scriptPath} ${mainScript} &&
        php -l ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'ruby': {
      let mainScript = resolve(dirPath, 'script.rb');
      return `
        mv ${scriptPath} ${mainScript} &&
        ruby --disable-gems -w -c ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'node': {
      let mainScript = resolve(dirPath, 'script.js');
      return `
        mv ${scriptPath} ${mainScript}
      `.replace(/\n/g, '');
    }
    default: {
      return 'exit 255';
    }
  }
}

function run() {
  let results = { status: 'IE', passed: 0 };
  co(function*() {
    let qFileList =
      yield glob(resolve(ROOTDIR, './question/*.q'), { realpath: true });

    for (let qFile of qFileList) {
      let aFile = path.format(Object.assign(
        path.parse(qFile),
        { base: base(qFile, '.q') + '.ans' }
      ));
      yield fsAsync.stat(aFile);

      let cwd = resolve(ROOTDIR, './script');
      let cmd =
        runCommand(LANG, cwd)
        .split(/\s+/).filter((a) => !!a);
      let child = spawn(
        '/usr/bin/time',
        [ '-f', '{"user":%U,"system":%S,"memory":%M}' ].concat(cmd),
        { stdio: ['pipe', 'pipe', 'pipe'], cwd: cwd }
      );

      fs.createReadStream(qFile).pipe(child.stdin);
      let std = yield Promise.all([
        streamString(child.stdout),
        streamString(child.stderr)
      ]);
      let exitCode = yield new Promise((resolve) => child.on('close', resolve));
      let output = std[0]; let info = std[1];
      let answer = yield fsAsync.readFile(aFile, 'utf8');
      info = JSON.parse(info.split('\n').filter((a) => !!a).reverse()[0]);

      if (info.memory > MEM_LIMIT_KB) {
        results.status = 'MLE';
        break;
      }
      if (info.user + info.system > CPU_LIMIT_TIME) {
        results.status = 'TLE';
        break;
      }
      if (exitCode !== 0) {
        results.status = 'RE';
        break;
      }
      if (output !== answer) {
        results.status = 'WA';
        break;
      }
      results.status = 'AC';
      results.passed ++;
    }

    console.log(JSON.stringify(results));
  })
  .catch((err) => {
    console.error(err.stack || err);
    console.log(JSON.stringify({ status: 'IE' }));
  });
}

function runCommand(lang, dirPath) {
  switch(lang.toLowerCase()) {
    case 'c':
    case 'c++':
    case 'c++11':
    case 'haskell': {
      let runPath = resolve(dirPath, 'runnable');
      return `
        ${runPath}
      `.replace(/\n/g, '');
    }
    case 'csharp': {
      let distPath = resolve(dirPath, 'runnable');
      return `
        mono ${distPath}
      `.replace(/\n/g, '');
    }
    case 'java': {
      return `
        java -ea -Xmx700m -Xverify:none
        -XX:+TieredCompilation -XX:TieredStopAtLevel=1 Main
      `.replace(/\n/g, '');
    }
    case 'python2': {
      let mainScript = resolve(dirPath, 'script.pyc');
      return `
        python ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'python3': {
      let mainScript = resolve(dirPath, 'script.py');
      return `
        python3 ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'swift': {
      let runPath = resolve(dirPath, '.build/debug/script');
      return `
        ${runPath}
      `.replace(/\n/g, '');
    }
    case 'perl': {
      let mainScript = resolve(dirPath, 'script.pl');
      return `
        perl -X ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'perl6': {
      let mainScript = resolve(dirPath, 'script.pl');
      return `
        perl6 ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'php': {
      let mainScript = resolve(dirPath, 'script.php');
      return `
        php ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'ruby': {
      let mainScript = resolve(dirPath, 'script.rb');
      return `
        ruby --disable-gems ${mainScript}
      `.replace(/\n/g, '');
    }
    case 'node': {
      let mainScript = resolve(dirPath, 'script.js');
      return `
        node ${mainScript}
      `.replace(/\n/g, '');
    }
    default: {
      return 'exit 255';
    }
  }
}
