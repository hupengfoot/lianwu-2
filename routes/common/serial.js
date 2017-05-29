/* jshint node:true*/
"use strict";

const express = require('express');
const router = express.Router();
const path = require('path');
const domain = require('domain');
const msg = require(path.join(global.rootPath, "define/msg"));

//对同一次接口访问的日志添加SN序号，方便查日志，并使用domain组件做异常捕获，防止进程崩溃
router.use(function(req, res, next){
    process.SN = (process.SN && ++process.SN) || 1;
    let d = domain.create();
    d.session = {};
    d.session.SN = process.SN;
    d.add(req);
    d.add(res);
    d.run(function(){
        next();
    });
    d.on('error', function(err) {
        console.error('domain error: ', err);
    });
});

module.exports = router;
