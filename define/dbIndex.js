/* jshint node:true*/
"use strict";

//支持数据库的业务拆分
var dbIndex = {
    dbDefault : 0,   //默认主库
    dbOne     : 1    //1号分库 
};

module.exports = dbIndex;


