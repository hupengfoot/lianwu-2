/* jshint node:true*/
"use strict";

const path = require('path');
const sqlPool = require(path.join(global.rootPath, "dbaccess/sqlPool"));

let exampleBiz = {};
var _ = {};

exampleBiz.helloWorld = function(cb){
    sqlPool.excute(1, [], cb);
};

module.exports = exampleBiz;
