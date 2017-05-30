const path = require('path');
const morgan = require('morgan');
const async = require('async');
const domain = require('domain');

const msg = require(path.join(global.rootPath, "define/msg"));

let _ = {};
let aMids = [];
let aFirstMids = [];
let accessLog = morgan("dev", {
    "stream":{write:function(str){console.info(str.trim());}}
});

_.commonInit = function(app){
    aFirstMids.push({f:null, r:null, a:accessLog});
    aFirstMids.push({f:'routes/common/serial', r:null});      // 捕获异常，添加请求SN序列号
    aFirstMids.push({f:'routes/common/post_data', r:null});      // 将post请求传递的参数也塞入req.url中，方便后面统一获取传入参数
    aFirstMids.push({f:'routes/common/url_params', r:null});      // 设置req.urlParams, 参数只解析一次
    aFirstMids.push({f:'routes/common/param_validate', r:null});      // 接口参数校验中间件
};

_.userInit = function(app){
	//用户侧
    aMids.push({f:'routes/example', r:'/example'});
    aMids.push({f:'routes/user/teacher', r:'/user/teacher'});
    aMids.push({f:'routes/user/school', r:'/user/school'});
};

_.masterInit = function(app){
    //管理侧
};

_.initRoutes = function(app){
    _.userInit(app);
    _.masterInit(app);
    
    console.time('async');
    let iMax = 0;
    let szMax = '';
    async.each(aMids, function(mid,callback){
        let t1 = new Date().getTime();
        let a = mid.a;
        if(mid.f){
            a = require(path.join(global.rootPath, mid.f));
        }
        if(mid.r){
            app.use(mid.r, a);
        }else{
            app.use(a);
        }
        let t2 = new Date().getTime();
        if(t2 - t1 > iMax){
            iMax = t2 - t1;
            szMax = require('util').format("{f:%s,r:%s,a:%s} used max time %dms", mid.f, mid.r, mid.a, t2-t1);
        }
        callback();
    },function(){
        console.log(szMax);
        console.timeEnd('async');

        // 异常捕获中间件
        app.use(function (err, req, res, next) {
            if (err) {
                console.error("express error:", err);
                msg.wrapper(msg.code.ERR_DB_ERR, null, res);
                return;
            }
            next();
        });
    });

};

// firstInit 需要最先初始化，且按顺序初始化，这里特殊处理
_.firstInit = function(app, cb){
    app.set('jsonp callback name', "callback");
    
    _.commonInit(app);

    async.eachSeries(aFirstMids, function(mid,callback){
        let a = mid.a;
        if(mid.f){
            a = require(path.join(global.rootPath, mid.f));
        }
        if(mid.r){
            app.use(mid.r, a);
        }else{
            app.use(a);
        }
        callback();
    },function(){
        cb();
    });
};

let initRoutes = function(app){
    _.firstInit(app, function() {
        _.initRoutes(app);
    });
};

module.exports = initRoutes;
