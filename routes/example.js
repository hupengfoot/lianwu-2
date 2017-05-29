/* jshint node:true*/
"use strict";

const express = require('express');
const router = express.Router();
const path = require('path');
const domain = require('domain');
const msg = require(path.join(global.rootPath, "define/msg"));
const exampleBiz = require(path.join(global.rootPath, "interfaceBiz/exampleBiz"));

//业务路由示例
router.use("/", function(req, res){
    exampleBiz.helloWorld(function(err, rows){
        msg.wrapper(err, rows, res);
    });
});

module.exports = router;
