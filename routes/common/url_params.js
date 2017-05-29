/* jshint node:true*/
"use strict";

const express = require('express');
const router = express.Router();
const url = require('url');

router.use(function(req, res, next){
    let param = url.parse(req.url, true).query;
    req.urlParams = param;  //业务侧统一采用 req.urlParams参数获取变量
    next();
});

module.exports = router;
