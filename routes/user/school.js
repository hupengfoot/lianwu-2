/* jshint node:true*/
"use strict";

const express = require('express');
const router = express.Router();
const path = require('path');
const domain = require('domain');
const msg = require(path.join(global.rootPath, "define/msg"));
const schoolBiz = require(path.join(global.rootPath, "interfaceBiz/schoolBiz"));

router.use("/add", function(req, res){
    var param = req.urlParams;
    schoolBiz.add(param.szName, param.szContactsName, param.szContactsWe, param.szContactsPhone, param.szContactsMail, param.szSchoolDesc, param.szArea, param.szType, param.iFullTime,  param.szCourseTime, function(err, rows){
	msg.wrapper(err, rows, res);
    });
});

router.use("/list", function(req, res){
    var param = req.urlParams;
    schoolBiz.list(param.iStart, param.iNum, function(err, rows){
	msg.wrapper(err, rows, res);
    });
});

module.exports = router;
