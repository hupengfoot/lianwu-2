/* jshint node:true*/
"use strict";

const path = require('path');
const sqlPool = require(path.join(global.rootPath, "dbaccess/sqlPool"));

let teacherBiz = {};
var _ = {};

teacherBiz.add = function(szName, szOpenID, szPhone, szSignature, szArea, szPrice, szType, szFreeTime, cb){
    sqlPool.excute(6000, [szName, szOpenID, szSignature, szArea, szPrice, szType, szPhone, szFreeTime], cb);
};

teacherBiz.list = function(iStart, iNum, cb){
    sqlPool.excute(parseInt(iStart), parseInt(iNum), function(err, rows){
	cb(err, rows);
    });
};

module.exports = teacherBiz;
