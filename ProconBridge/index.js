'use strict';

const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const co = require('co');
const mongoose = require('mongoose');
const pify = require('pify');
const Docker = require('dockerode');
const WritableStreamBuffer = require('stream-buffers').WritableStreamBuffer;

const loadModels = require('./load_models');
loadModels();

const User = mongoose.model('User');
const Score = mongoose.model('Score');
const Judge = mongoose.model('Judge');

const qdir = process.env['QDIR'];
const tmpdir = process.env['TMP'];
console.log({ tmp: tmpdir, qdir: qdir });

let docker = new Docker({ socketPath: '/var/run/docker.sock' });

let judge = co.wrap(function*(json) {
  console.log(json);
  if (!json.tmp || !json.lang) {
    return { status: 'IE' };
  }

  let result, output;

  output = new WritableStreamBuffer();
  result = yield pify(docker.run, {multiArgs: true}).bind(docker)(
    'judge',
    [ 'build', json.lang ],
    output,
    {
      'Env': [ 'WORKDIR=/data' ],
      'NetworkDisabled': true,
      'HostConfig': {
        'Binds': [
          `${tmpdir}/${json.tmp}:/data/script:rw,z`
        ]
      }
    });

  yield pify(result[1].remove).bind(result[1])();
  try {
    output = JSON.parse(output.getContentsAsString().match(/(\{[\s\S]*?\})/)[0]);
  } catch (_err) {
    return { status: 'IE' };
  }
  if (output.status === 'IE' || output.status === 'CE') return output;

  output = new WritableStreamBuffer();
  result = yield pify(docker.run, {multiArgs: true}).bind(docker)(
    'judge',
    [ 'run', json.lang ],
    output,
    {
      'Env': [ 'WORKDIR=/data' ],
      'NetworkDisabled': true,
      "HostConfig": {
        "Binds": [
          `${qdir}/${json.question}/data:/data/question:ro,z`,
          `${tmpdir}/${json.tmp}:/data/script:ro,z`
        ],
        'Memory': 256 * 1024 * 1024,
        'MemorySwap': -1,
        'Ulimits': [
          { 'Name': 'nproc', 'Soft': 3, 'Hard': 3 },
          { 'Name': 'cpu', 'Soft': 5, 'Hard': 5 }
        ]
      }
    });

  yield pify(result[1].remove).bind(result[1])();
  try {
    output = JSON.parse(output.getContentsAsString().match(/(\{[\s\S]*?\})/)[0]);
  } catch (_err) {
    return { status: 'IE' };
  }
  return output;
});

let main = co.wrap(function*() {
  let info = yield Judge
    .findOneAndUpdate({ status: 'waiting' }, { status: 'pending' })
    .sort({ submitted: 'asc' }).exec();
  if (!info) return;

  let tmpinfo = yield pify(tmp.dir, {multiArgs: true})
    .bind(tmp)({ unsafeCleanup: true, template: '/tmp/tmp-XXXXXX' });
  console.log(tmpinfo[0]);
  yield pify(fs.writeFile).bind(fs)(tmpinfo[0] + '/script', info.code);
  let result = yield judge({
    lang: info.lang,
    question: info.question,
    tmp: path.basename(tmpinfo[0])
  });
  tmpinfo[1](); // Cleanup

  yield Judge.findByIdAndUpdate(info.id, { status: result.status }).exec();

  if (result.status !== 'AC') return;

  // Add score
  let score = parseInt(info.question.split('-')[0], 10) || 0;

  if (!(yield Score.findOne({ question: info.question }).exec())) {
    score = parseInt(score * 1.1, 10);
  }

  let user = yield User.findOne({ username: info.username }).exec();

  let query = {
    username: info.username,
    question: info.question
  };

  let scoreInfo = yield Score.findOne(query).exec();

  if (!!scoreInfo) return;

  yield Score.findOneAndUpdate(
    query,
    { score: score },
    { upsert: true }
  ).exec();
  yield User.findByIdAndUpdate(
    user.id,
    { score: user.score + score }
  ).exec();
});

connect()
  .on('error', console.log)
  .on('disconnected', connect)
  .once('open', loop);

function connect () {
  let options = { server: { socketOptions: { keepAlive: 1 } } };
  let db =
    `mongodb://${process.env['MONGO_PORT_27017_TCP_ADDR']}:${process.env['MONGO_PORT_27017_TCP_PORT']}/yehd`;
  return mongoose.connect(db, options).connection;
}

function loop() {
  Promise.all(Array(10).fill().map(() => main()))
    .then(() => setTimeout(loop, 500))
    .catch((err) => {
      console.log(err.stack || err);
      setTimeout(loop, 500);
    });
}
