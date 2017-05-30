/* jshint node:true*/
"use strict";

const path = require('path');
const sqlPool = require(path.join(global.rootPath, "dbaccess/sqlPool"));

let schoolBiz = {};
var _ = {};

schoolBiz.add = function(szName, szContactsName, szContactsWe, szContactsPhone, szContactsMail, szSchoolDesc, szArea, szType, szCourseTime, cb){
    sqlPool.excute(6001, [szName, szContactsName, szContactsWe, szContactsPhone, szContactsMail, szSchoolDesc, szArea, szType, szCourseTime], cb);
};

schoolBiz.list = function(iStart, iNum, cb){
    sqlPool.excute(3, [parseInt(iStart), parseInt(iNum)], function(err, rows){
	cb(err, rows);
    });
};

module.exports = schoolBiz;
