/* jshint node:true*/
"use strict";

const express = require('express');
const router = express.Router();
const path = require('path');
const domain = require('domain');
const msg = require(path.join(global.rootPath, "define/msg"));
const teacherBiz = require(path.join(global.rootPath, "interfaceBiz/teacherBiz"));

//业务路由示例
router.use("/add", function(req, res){
    var param = req.urlParams;
    if(param.szSignature === undefined || param.szSignature === null){
	param.szSignature = "";
    }
    teacherBiz.add(param.szName, param.szOpenID, param.szPhone, param.szSignature, param.szArea, param.szPrice, param.szPrice1, param.szPrice2, param.szType, param.szFreeTime, function(err, rows){
	msg.wrapper(err, rows, res);
    });
});

router.use("/list", function(req, res){
    var param = req.urlParams;
    teacherBiz.list(param.iStart, param.iNum, function(err, rows){
	msg.wrapper(err, rows, res);
    });
});

module.exports = router;
