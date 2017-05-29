"use strict";

//log4js相关的配置 需要的进程直接require本文件即可 无依赖
//做的事情 1、接管原有的console.log console.error方法 全部打到 标准输出
//         2、在每一行前加时间戳 

let log4js = require('log4js');

let logConf = {
    appenders : [ {
        type:'console',
        layout: {
            type: 'pattern',
            pattern: "%[[%d] %5.5p%] - %m"
        }
    }],
    replaceConsole: true
};


log4js.configure(logConf);

log4js.getLogger().setLevel('DEBUG');

var console_trace = require('console-trace')({always:true});

