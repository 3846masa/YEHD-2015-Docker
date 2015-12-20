'use strict';

const Handlebars = require('handlebars');
const fetch = require('node-fetch');
const fs = require('fs');
const co = require('co');

let source   = fs.readFileSync('./index.hbs', 'utf8');
let template = Handlebars.compile(source);

let main = co.wrap(function*() {
  let scores =
    yield fetch('https://yehd-ctf.meiji-ncc.tech/api/users').then((res) => res.json());
  scores.users = scores.users.sort((a, b) => b.score - a.score);
  let html = template(scores);
  fs.writeFileSync('./index.html', html, 'utf8');
});

(function loop() {
  main().then(() => {
    setTimeout(loop, 10000);
  }).catch((err) => {
    console.error(err.stack);
  });
})();
