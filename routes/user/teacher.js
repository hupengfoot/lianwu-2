/* jshint node:true*/
"use strict";

const express = require('express');
const router = express.Router();
const path = require('path');
const domain = require('domain');
const msg = require(path.join(global.rootPath, "define/msg"));

//业务路由示例
router.use("/", function(req, res){
    var param = req.urlParams;
    msg.wrapper(null, param, res);
});

module.exports = router;
