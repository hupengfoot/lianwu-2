/* jshint node:true*/
"use strict";
global.rootPath = __dirname;
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
let app = express();

const global_config = require(path.join(global.rootPath, './config/global_conf')).global_config;
//替换console的log 全局接管日志输出
global.logConf = require(path.join(global.rootPath, 'util/logConf'));

app.use(bodyParser.json({limit : '1mb'}));
app.use(bodyParser.urlencoded({extended : true, limit : '1mb'}));
//如果是加密的cookie，设置一个尝试解密的密码
app.use(cookieParser("ZC_COOKIE_STR_AQC"));
app.use(express.static(path.join(__dirname, 'public')));

app.disable('x-powered-by'); //处于安全考虑

process.env.TZ='Asia/Hong_Kong';

//接口定义初始化
const route_define = require(path.join(global.rootPath, 'define/user_query'));
global.queryCenter = require(path.join(global.rootPath, 'routes/queryCenter'));
global.queryCenter.initRouterDefine(route_define);

//获取业务进程本地IP
let network = require(path.join(global.rootPath, 'util/network'));
global.LOCAL_IP = network.get_local_ip();

if(global_config.redis === 1){
    //初始化redis
    let redisMgr = require(path.join(global.rootPath, 'redis/redis_mgr'));
    redisMgr.init(global.LOCAL_IP, global.port);
}


function initDelay() {
    let initRoutes = require('./routes/init');
    initRoutes(app);
}

app.get('/', function(req, res, next){
    let param = url.parse(req.url, true).query;
    res.jsonp(param.echostr);
});

let _TIME_DELAY = 1000; // 延时启动
setTimeout(initDelay, _TIME_DELAY);

module.exports = app;
