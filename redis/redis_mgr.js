/*
如果发生redis挂掉的事故，按照设计会自动切换从库。
1、从库的配置在config/redis.json中
2、如果发生主库挂掉，并发生client挂掉(例如www挂掉)，配置不需要
   也不应该修改，启动的时候会自动链接主库-失效-从库.
3、主库失效，会又一次重试，重试时间可以参考配置，不易过长，失效期间的请求没有保证。
    配置参考（https://github.com/mranney/node_redis）
4、主库的恢复，千万要注意、千万要注意，不要配置主库自动重启
    原因参考（http://redis.io/topics/replication）

其他注意事项：    
5、所有redis COMMAND函数，都进行过hook，阅读代码请注意    
*/
const path = require("path");
const redis_node = require('redis');
const fs = require('fs');
const async = require('async');
const assert = require("assert");
const uuid = require('node-uuid');
const S = require('string');
const util = require('util');
const os = require('os');

const debugTool = require(path.join(global.rootPath, 'util/debugTool'));
const global_config = require(path.join(global.rootPath, 'config/global_conf')).global_config;
const redis_define = require(path.join(global.rootPath, 'define/redis')).redis_define;
let redis_type_enum = redis_define.enum;
let redis_timer_enum = redis_define.timer;
let redis_channel_enum = redis_define.redis_channel_enum;
let redis_channel_num_define = redis_define.redis_channel_num_define;

let redis_array = [];
let redis_sub_array = [];

let redis_config;
let redis_type = [];
let redis_timer = [];

let redis_channel = [];         //存储各种channel对应的具体function
let redis_channel_name = [];    //存储各种channel的名称
let redis_channel_num = [];     //存储各种channel的具体接听者
let curPort = 0;
let szTimerSetKey = '';
let redis_SupportCommand = ['set2', 'setnx2', 'hkeys', 'hset', 'hsetnx', 'hget', 'hgetall', 'hdel', 'hmset', 'hmget', 'del2',
                       'keys', 'get2', 'incrby', 'mget', 'mset', 'rpush2', 'rpush2Expire', 'zrevrange2', 'sadd2', 'sadd2WithLimit', 'srem2', 'ltrim', 
                       'smembers2', 'sismember2', 'scard2', 'spop2', 'spopmulti2', 'srandmember2', 'zadd2', 'zaddarr2', 'zincrby2', 'zscore2', 'zcard2', 'zrevrank2', 'zrem2',
                       'zremrangebyrank2', 'zrangebyscore2', 'lpop2', 'lpush2', 'llen', 'lrange', 'lremall', 'zpop2'];
let redis_mgr = {};
let redis_oldFunc = {};
let _ = {};

_.enableExpireCallback = 0;

let debug = function() { };
if (process.env.NODE_DEBUG && /redis_mgr/.test(process.env.NODE_DEBUG)) {
  debug = console.info;
}


redis_mgr.silence = function(bRes){
    if(bRes){
        _.output = function(){};
    }else{
        _.output = console.log;
    }
};

redis_mgr.enableExpireCallback = function(){
    _.enableExpireCallback = 1;
};

_.callReal = function(arg, szName){
    let func = redis_oldFunc[szName];
    switch(arg.length){
        case 2:
            func(arg[0], arg[1]);
        break;
        case 3:
            func(arg[0], arg[1], arg[2]);
        break;
        case 4:
            func(arg[0], arg[1], arg[2], arg[3]);
        break;
        case 5:
            func(arg[0], arg[1], arg[2], arg[3], arg[4]);
        break;
        default:
            assert(false, "NOT SUPPORT REDIS COMMAND!");
        break;
    }
};

_.atomic_getdel="local v = redis.call('GET', ARGV[1]) redis.call('DEL', ARGV[1]) return v";
_.atomic_incrby=
    "local v=redis.call('EXISTS',ARGV[1]);local x=redis.call('INCRBY',ARGV[1],ARGV[3]) if v == 0 then redis.call('EXPIRE',ARGV[1],ARGV[2]) end return x";
_.atomic_incrby_cb=
    "local v=redis.call('EXISTS',ARGV[1]);local x=redis.call('INCRBY',ARGV[1],ARGV[3]) if v==0 then redis.call('SETEX',ARGV[4],ARGV[2],1) end return x";
_.atomic_zpop="local v = redis.call('ZRANGEBYSCORE', KEYS[1], ARGV[1], ARGV[2]); local r = redis.call('ZREMRANGEBYSCORE', KEYS[1], ARGV[1], ARGV[2]); return v;";
_.atomic_sadd_with_limit = 
"    local arrResult = {0, 0}; " +    
"    local size = redis.call('SCARD', KEYS[1]); " + 
"    local limit = tonumber(ARGV[2]); " + 
"    if size < limit then " +
"        local iAdd = redis.call('SADD', KEYS[1], ARGV[1]); " +
"        arrResult[1] = 1; " + // lua 数组索引从1 开始 ： 是否存在
"        arrResult[2] = size + iAdd; " + // 返回新增之后的实际大小
"        return arrResult; " +
"    else " + 
"        arrResult[1] = redis.call('SISMEMBER', KEYS[1], ARGV[1]);   " +
"        arrResult[2] = size; " +
"        return arrResult; " +
"    end; ";

/***
 * 1、如果同一个key，两次回调时间小于1s，则认为是并发引起的问题，不予回调
 *    并发问题：
 *    A:ACCESS key
 *    B:expire key
 *    C:check TTL（==-2）
 *    D::getdel
 *    E:ACCESS key
 *    F:check TTL(==-2) (this is a new key but without expire)
 *    G:getdel
 *    H:expire key
 * 2、如果已经key，已经超时，但是超时回调的时候进程没有再跑，则下次access key的时候
 *    会立即发生一次超时回调
 *    说明：
 *    access key
 *    进程不再运行
 *    启动
 *    access key 继承上次超时时间继续算,如果停服时间超过超时时间，立即超时
 *    
 ***/
_.expireCall = function(iType, key, from, cb){
    let pkey = "__PEX_" + key;
    let iNow = Math.floor(new Date());
    let inst = _.getRedis(iType);
    inst.get(pkey, function(err, value){//last expire callback time
        if(value && iNow - value < 1000){ //small than 1 s
            if(cb) cb();
        }else{
            inst.setex(pkey, 10, iNow);
            inst.eval(_.atomic_getdel, 0, key, function(err, value){
                if(value){
                    console.log("%s:redis expire call type %s key %s value %s", from, iType, key, value);
                    redis_type[iType].Func(_.get_origin_name(iType, key), value);
                }
                if(cb) cb();
            });
        }
    });
};

_.createWrap = function(szName){
    return function(){
        let arg = arguments;
        let iType = arg[0];
        debug("call redis command %s type %s", szName, iType);
        let moniterObj={func:szName, type:iType};
        async.waterfall([
            function(callback){
                moniterObj.key = arg[1];
                if(typeof arg[1] == 'string' || typeof arg[1] == 'number'){
                    if(_.checkKey(arg[1])){
                        assert(false, util.format("redis %s recv null key:%s", szName, arg[1]));
                        return;
                    }
                    if(_.checkType(arg[0])){
                        assert(false, util.format("redis %s recv error iType:%s", szName, arg[0]));
                    }
                    arg[1] = _.get_name(iType, arg[1]);
                    callback(null);
                }else{
                    callback(1);
                }
            },function(callback){
                if(redis_type[iType].Func && typeof redis_type[iType].Func == "function"){
                    let inst = _.getRedis(iType);
                    inst.ttl(_.expireKey(iType, arg[1]), function(err, res){
                        if(res == -1 || res == -2){ //key expire already, call the expire function
                            _.expireCall(iType, arg[1], "ACCESS", function(){
                                callback(1);
                            });
                        }else{
                            callback(1);
                        }
                    });
                }else{
                    callback(1);
                }
            }
        ],function(err){
            _.callReal(arg, szName);
        });
    };
};

_.init = function(){
    let redis_CommandDic = {};
    for(let c in redis_SupportCommand){
        redis_CommandDic[redis_SupportCommand[c]] = 1;
    }
    for(let obj in redis_mgr){
        if(typeof redis_mgr[obj] == "function"){
            if(redis_CommandDic[obj] == 1){
                redis_oldFunc[obj] = redis_mgr[obj];
                redis_mgr[obj] = _.createWrap(obj);
            }
        }
    }
};

_.get_name = function(iType, key){
    if(typeof redis_type[iType] == 'undefined'){
        assert(false, util.format("redis type error %s", iType));
    }
    return redis_type[iType].Pre + "_" + key;
};

_.get_origin_name = function(iType, key){
    iType = parseInt(iType);
    return key.replace(redis_type[iType].Pre+"_", "");
};

_.getRedis = function(iType){
    if(typeof redis_type[iType] == 'undefined'){
        assert(false, util.format("redis type error %s", iType));
    }
    if(redis_type[iType].iIndex) return redis_array[redis_type[iType].iIndex];
    return redis_array[0];
};

//检查某个channel是否存活, cb:function(bool)
_.checkAlive = function(name, cb){
    redis_array[0].pubsub('NUMSUB', name, function(err, aNums){
        if(err){
            console.error('fail to check channel alive %s', name);
            console.error(err);
            cb(false);
        }else{
            let iNum = aNums[1];
            cb(parseInt(iNum) !== 0);
        }
    });
};

_.onMessage = function(redis_inst, channel, message){
    if (message && Buffer.isBuffer(message)) { // 由于 detect_buffers: true 的影响，这里message的返回类型将始终是buffer，因此这里统一处理下，给上层返回string
        message = message.toString();
    }
    if(typeof redis_channel[channel] === 'function'){
        redis_channel[channel](message);
    }else{
        if(message && (typeof message == 'string')){
            if(message.indexOf('__EX_') === 0 && _.enableExpireCallback == 1){
                let key = message.replace('__EX_', '');
                let iType = key.substring(0, key.indexOf('_'));
                if(_.checkType(iType)){
                    console.error("redis notify key error %s", message);
                    return;
                }
                if(typeof redis_type[iType].Func !== 'function'){
                    console.error('redis recv expire callback without register function %s', message);
                    return;
                }
                key = key.replace(iType+'_', '');
                let inst = _.getRedis(iType);
                if(true || redis_type[iType].EXPIRE_ALL == 1){
                    _.expireCall(iType, key, "EXPIRE");
                }
            }
        }
    }
};

_.stopSlave = function(redis_inst){
    redis_inst.slaveof("NO", "ONE", function(err, res){
        if(err){
            console.error("redis %s:%d fail to stop slaveof no one", 
                         redis_inst.options.host,
                         redis_inst.options.port);
            console.error(err);
        }else{
            console.log("success slaveof no one");
        }
    });
};

_.onEnd = function(err, redis_inst){
    // TCP Connection disconnected
    console.error("REDIS: connection to redis is disconnected!!!");
    //console.error("err=", err);
    //console.error("redis_inst=", redis_inst);
};

_.onError = function(err, redis_inst){
    let iLength = redis_config.length;
    console.error("Redis Error occupied, have [%d] configuration(s) err=",iLength, err);

    let szHost, iPort, szPwd;
    let iIdx = 0, szTxt = '';
    const network = require(path.join(global.rootPath, 'util/network'));
    for(let i=0; i!=iLength; ++i){
        if(redis_inst.options.host == redis_config[i].szRedisIP &&
           redis_inst.options.port == redis_config[i].szRedisPort){
            iIdx = i;
            szHost = redis_config[i].szSlaveIP;
            iPort = redis_config[i].szSlavePort;
            szPwd = redis_config[i].szSlavePwd;
            console.error("switch to slave redis[%d]->[%s:%d]", i, szHost, iPort);
            break;
        }
    }
    if(szHost && iPort && szPwd){
        if(redis_array[iIdx].options.host != szHost || 
           redis_array[iIdx].options.port != iPort &&
           redis_inst.attempts > 1){
            //启动连接到slave，这个地方有一点风险，只给主redis 1 次重试的机会
            redis_array[iIdx] = _.connect(iPort, szHost, szPwd);
            _.stopSlave(redis_array[iIdx]);
            redis_sub_array[iIdx] = _.connect(iPort, szHost, szPwd);
            redis_sub_array[iIdx].subscribe("__keyevent@0__:expired"); 
            redis_sub_array[iIdx].on('message', function(channel, msg){
                _.onMessage(redis_sub_array[iIdx], channel, msg);
            });
            szTxt = util.format('严重故障(%s)：REDIS %s:%s 链接失败（挂了），链接到配置的从库 %s:%s',
                      network.get_local_ip(),
                      redis_inst.options.host, redis_inst.options.port, szHost, iPort);
            console.error(szTxt);
        }else{
            //走到这里是主redis还在不停的重试
            console.error('!!! redis %s:%s error !!! attempt:%s', 
                      redis_inst.options.host, redis_inst.options.port,
                      redis_inst.attempts);
        }
    }else{
        //要命了，没有从库了
        szTxt = util.format('致命故障(%s)：REDIS %s:%s 链接失败（挂了），无配置从库',
            network.get_local_ip(),
            redis_inst.options.host, redis_inst.options.port);
        console.error(szTxt);
    }
};

let gCurNum = 0; //循环计数
_.send = function(name, param, aLiveNum){
    let szName = name;
    if(aLiveNum){
        let iRealNum = aLiveNum[(gCurNum++) % aLiveNum.length];
        szName = name + iRealNum;
    }
    //console.log('send real channel num is %s%d', name, iRealNum);
    if(typeof param == 'object'){
        redis_array[0].publish(szName, JSON.stringify(param));
    }else{
        redis_array[0].publish(szName, param);
    }
};

let sendWarningcb = function(err, result){
    if(err || !result) console.error(err);
};

_.onConnect = function(redis_inst){
    _.output("redis %s:%d connect success", redis_inst.options.host,
              redis_inst.options.port);
};

_.checkKey = function(key){
    let bRes = false;
    if(key === null || (typeof key == 'undefined')){
        bRes = true;
    }
    if(typeof key == 'number' && isNaN(key)) bRes = true;
    if(typeof key == 'string' && key.length === 0) bRes = true;
    if(bRes){
        console.error("redis_mgr recv error key %s", key);
    }
    return bRes;
};

_.checkType = function(iType){
    let bRes = false;
    iType = parseInt(iType);
    if(iType === null || (typeof iType !== 'number') || isNaN(iType)){
        bRes = true;
    }
    if(typeof redis_type[iType] == 'undefined'){
        bRes = true;
    }
    if(bRes){
        console.error("redis_mgr recv error iType %s", iType);
    }
    return bRes;
};

_.connect = function(port, ip, pwd){
    // detect_buffers: true 如果传入参数有一个为buffer，则传出结果也都是buffer
    let redis_inst = redis_node.createClient(port, ip, {retry_strategy: function (options){
        if (options.error && options.error.code === 'ECONNREFUSED') {
            // End reconnecting on a specific error and flush all commands with a individual error
            return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            // End reconnecting after a specific timeout and flush all commands with a individual error
            return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
            // End reconnecting with built in error
            return undefined;
        }
        // reconnect after
        return Math.min(options.attempt * 100, 3000);
    }, detect_buffers: true}); 

    redis_inst.auth(pwd, function (err) { if (err) throw err; });
    redis_inst.on('error', function(err){
        _.onError(err, redis_inst);
    });
    redis_inst.on('connect', function(err){
        _.onConnect(redis_inst);
    });
    redis_inst.on('end', function(err){
        _.onEnd(err, redis_inst);
    });
    return redis_inst;
};

/*
 *  每种类型的timer仅需要注册一次，同种类型的Timer注册一个回调函数
 *  函数返回一个句柄，用于标识，在启动的时候，需要注册的模块先行注册
 */
redis_mgr.regTimer = function(timer_enum, func){
    if(typeof timer_enum !== 'number' || typeof timer_enum === 'undefined'){
        console.error('%s register timer fail', debugTool.getCaller());
        console.error('add redis timer at define/redis.js');
        return null;
    }
    console.log("%s register a timer class", debugTool.getCaller());
    redis_timer[timer_enum] = func;
    return timer_enum;
};

/*
 * Func:基于redis的Timer,每次注册只能执行一次,可以落地，保证一定的容灾性
 * param:func 回调函数
 *       timeT 时间、秒
 *       obj 回掉函数的参数,可以传一个null
 */
redis_mgr.addTimer = function(timeT, obj, iType){
    if(iType === null){
        console.error("add a null handle timer");
        return;
    }
    let szUUID = uuid.v1();
    let iNow = Math.floor(new Date().getTime() / 1000);
    let param = {i:iType,o:obj,u:szUUID,n:iNow,t:timeT};
    redis_mgr.sadd2(redis_type_enum.TIMER, szTimerSetKey, JSON.stringify(param));
    setLongTimeout(timeT * 1000, param);
};

//约24天
let MAX_TIMEOUT = 2147483647;
function setLongTimeout(mTimeT, param){
    if(mTimeT > MAX_TIMEOUT){
        setTimeout(idlingCall, MAX_TIMEOUT, param, mTimeT);
    }else{
        setTimeout(timerCall, mTimeT, param);
    }
}

function idlingCall(obj, mTimeT){
    let newMTimeT = mTimeT - MAX_TIMEOUT;
    if(mTimeT > MAX_TIMEOUT){
        setTimeout(idlingCall, MAX_TIMEOUT, obj, newMTimeT);
    }else{
        setTimeout(timerCall, obj.t * 1000, obj);
    }
}

//cb:function(info) info 为数组，如果没有Timers，返回[] 如果发生错误，返回null
redis_mgr.getTimers = function(cb){
    redis_mgr.smembers2(redis_type_enum.TIMER, szTimerSetKey, function(err, info){
        if(info && info.length > 0){
            cb(info);
        }else{
            if(err){
                console.error("fail to get all timers %s", err);
                cb(null);
            }else{
                cb([]);
            }
        }
    });
};

function timerCall(obj){
    redis_mgr.srem2(redis_type_enum.TIMER, szTimerSetKey, JSON.stringify(obj));
    redis_timer[obj.i](obj.o);
}

/*
 * Func: function(key, value)
 * redis 过期回调
 * example:
 * redis_mgr.regExpire(redis_type_enum.VERIFY_CODE, function(key, value){
 *   console.error(key);
 *   console.error(value);
 * });
 */
redis_mgr.regExpire = function(iType, Func){
    if(typeof redis_type[iType] === 'undefined'){
        console.error('register redis callback function fail of type %d', iType);
        return;
    }
    redis_type[iType].Func = Func;
};

/*
 * regChannelFile & sendFile 配对使用
 * Func: function(szTmpFileName) szTmpFileName 位于/tmp/临时文件名
 */
redis_mgr.regChannelFile = function(iType, Func){
    redis_mgr.regChannel(iType, function(msg){
        let buf = new Buffer(msg, 'binary');
        let szName = '/tmp/'+uuid.v1();
        console.error('open file:' + szName);
        fs.open(szName, 'w', function(status, fd){
            if(fd > 0){
                let iNum = fs.writeSync(fd, buf, 0, buf.length);
                if(iNum != buf.length){
                    console.error('fail to write file %s', szName);
                    Func(null);
                }else{
                    Func(szName);
                }
            }else{
                Func(null);
            }
        });
    });
};

redis_mgr.sendFile = function(iType, szFileName){
    async.waterfall([
        function(callback){
            fs.stat(szFileName, function(err, stat){
                if(err){
                    callback(err);
                }else{
                    callback(null, stat.size);
                }
            });
        },function(iSize, callback){
            let buf = new Buffer(iSize);
            fs.open(szFileName, 'r', function(status, fd){
                fs.read(fd, buf, 0, iSize, 0, function(err, num){
                    let szBuf = buf.toString('binary');
                    redis_mgr.send(iType, szBuf);
                    callback(null);
                });
            });
        }
    ],function(err){
    });
};

/*
 * message 对应哪个channel已经被当前channel的master ready了
 */
_.regChannelSlave = function(message, Func){
    redis_array[0].lpop('CHANNEL_LIST_' + message, function(err, res){
        if(err || !res){
            console.error("CHANNEL_LIST FIRST TIME %s RECV ERROR %s, RES %s", message, err, res);
            setTimeout(_.regChannelSlave2, 3000, message, Func);
        }else{
            let szName = message + res;
            console.error('subscribe channel %s', szName);
            redis_sub_array[0].subscribe(szName);
            redis_channel[szName] = Func;
        }
    });     
};
// 尝试2次，避免第一次时间差问题获取不了就crash
_.regChannelSlave2 = function(message, Func){
    redis_array[0].lpop('CHANNEL_LIST_' + message, function(err, res){
        if(err || !res){
            console.error("CHANNEL_LIST SECOND TIME %s RECV ERROR %s, RES %s", message, err, res);
            assert(false, util.format("CHANNEL_LIST %s RECV ERROR %s, RES %s", message, err, res));
        }else{
            let szName = message + res;
            console.error('subscribe channel %s', szName);
            redis_sub_array[0].subscribe(szName);
            redis_channel[szName] = Func;
        }
    });
};

/*
 * regChannel 和 send需要配对使用
 * Func: function(message)
 */
redis_mgr.regChannel = function(iType, Func){
    if(isNaN(parseInt(iType))){
        console.error('regChannel fail type %s', iType);
        return;
    }
    let name = redis_channel_name[iType];
    let num = redis_channel_num[iType];
    if(num > 0){
        // 有多个进程抢到master资格的话，有可能导致lpush进去重复的空闲编号
        redis_mgr.lock(name, 10000, function(err, result){
            console.error("========lock", name);
            if(!err && result == 'OK'){ //抢到了锁, 这个地方有点弱，下列代码需要在3s内执行完
                redis_array[0].pubsub('CHANNELS', name+"*", function(err, res){
                    let aEmptyChannels = []; //存储可用的channel的name
                    let iCurCnt = res.length; //当前已经listen的数目
                    for(let i=0; i!=num; ++i){
                        if(res.indexOf(name + i) == -1){ //空的channel
                            aEmptyChannels.push(i);
                        }
                    }
                    console.error("channel %s find empty cnt %s", name, aEmptyChannels.length);
                    if(aEmptyChannels.length > 0){
                        let iChannelNum = aEmptyChannels.shift();
                        let szName = name + iChannelNum.toString();
                        console.error('subscribe master channel %s', szName);
                        redis_sub_array[0].subscribe(szName);
                        redis_channel[szName] = Func;
                        let iEmptyCnt = aEmptyChannels.length;
                        redis_array[0].del('CHANNEL_LIST_'+name, function (err) {
                            if (err) {
                                console.error("DELETE CHANNEL_LIST_ key failed, err=", err);
                            }
                            let szChannelListName = 'CHANNEL_LIST_' + name;
                            aEmptyChannels.unshift(szChannelListName);
                            redis_array[0].lpush(aEmptyChannels, function (err) {
                                if (err) {
                                    console.error("lpush CHANNEL_LIST_ failed, err=", err);
                                }
                            });
                        });

                    }else{//全部订阅满了？holy shit
                        console.error('ALL CHANNEL SUBSCRIBE, HOLY SHIT, YOU SUBSCRIBE FAIL');
                    }
                });
            }else{
                setTimeout(_.regChannelSlave, 5000, name, Func);
            }
        });
    }else{
        redis_sub_array[0].subscribe(name);
        redis_channel[name] = Func;
    }
};

let dtLastTime = 0; //上次检查live时间
let gLiveNum = []; //上次检查live的时候，存活的channel的编号
redis_mgr.send = function(iType, param){
    if(isNaN(parseInt(iType))){
        console.error('send fail type %s', iType);
        return;
    }
    let name = redis_channel_name[iType];
    let num = redis_channel_num[iType];
    if(dtLastTime === 0 && num >= 0){
        for(let i=0; i!=num; ++i){
            gLiveNum[i] = i;
        }
    }
    if(num > 0){ //这个channel配置多个接收者
        let iNow = Math.floor(new Date().getTime() / 1000);
        if(iNow - dtLastTime > 10){ //每十秒检查一下对端是否存活
            console.log('begin to check channel %s', name);
            dtLastTime = iNow;
            redis_array[0].pubsub('CHANNELS', name+'*', function(err, res){
                if(!err && res){
                    let iNum = res.length; //当前存活的个数
                    if(iNum != num){ //出事了, 现在要找出来谁死了
                        console.error("%s live channel count(%d) is not equal config(%d)", name, iNum, num);
                        if(iNum > num){ //可能是配置配错了, 存活的比配置的多？？？
                            console.error("%s config count(%d) is small than live(%d), use live count", name, num, iNum);
                            num = iNum;
                        }
                        gLiveNum = [];
                        let iLiveCnt = 0;
                        let count = 0;
                        async.whilst(
                            function() {return count < num; },
                            function(callback){
                                _.checkAlive(name + count, function(bAlive){
                                    if(bAlive){
                                        gLiveNum[iLiveCnt] = count;
                                        iLiveCnt ++;
                                    }
                                    count ++;
                                    callback();
                                });
                            },function(err){
                                console.error('%s, now live channel is %s', name, gLiveNum.join(','));
                                _.send(name, param, gLiveNum);
                            }
                        );
                    }else{
                        //console.error("%s fail to check redis channel %s", name, JSON.stringify(err));
                        _.send(name, param, gLiveNum);
                    }
                }else{ //可能对端还没有一个启动, 这个时候只能假设所有人都活着
                    _.send(name, param, gLiveNum);
                }
            });
        }else{
            _.send(name, param, gLiveNum);
        }
    }else{
        _.send(name, param, null);
    }
};

//传已经get_name处理过的key
//redis 过期处理并不准确
_.expireKey = function(iType, key){
    let ex = '__EX_'+iType+'_'+key;
    return ex;
};

redis_mgr.expire2 = function(iType, key){
    if(redis_type[iType].TIMEOUT){
        let inst = _.getRedis(iType);
        if(redis_type[iType].Func && typeof redis_type[iType].Func == 'function'){
            inst.setex(_.expireKey(iType,key), redis_type[iType].TIMEOUT, 1);
        }else{
            inst.expire(key, redis_type[iType].TIMEOUT, function(err, res){
                if(err || res === 0){
                    console.error("failt to set expire to key %s", key);
                }
            });   
        }
    }
};

_.output = console.log; 

redis_mgr.init = function(ip, port){
    _.init();
    curPort = port;
    szTimerSetKey = 'REDIS_TIMER_' + ip + "_" + curPort;
    let szFile = fs.readFileSync(path.join(global.rootPath, 'config/redis.json'), {encoding:'utf8'});
    if(szFile && szFile.length > 0){
        redis_config = JSON.parse(szFile);
        let idx = 0;
        async.eachSeries(redis_config, function(config, cb){
            _.output('----------------------------');
            _.output('begin to init the %d redis %s:%s', idx, config.szRedisIP, config.szRedisPort);
            _.output('----------------------------');
            redis_array[idx] = _.connect(config.szRedisPort, config.szRedisIP, config.szPwd);
            redis_array[idx].get('REDIS_MY', function(err, value){
                if(value === null || typeof value == 'undefined'){
                    redis_array[idx].set('REDIS_MY', __dirname);
                }else{
                    if(value != __dirname){
                        console.log("======================================");
                        console.log('redis %s compare to now %s', value, __dirname);
                        console.error("!!!!!!!!CURRENT REDIS PORT %d!!!!!!!!", global_config.iRedisPort);
                        console.error("!!!!!!!!PLEASE USE YOUR REDIS!!!!!!!!");
                        console.log("=============== channels ===================");
                        assert(false);
                    }
                }
                idx++;
                cb();
            });
            redis_sub_array[idx] = _.connect(config.szRedisPort, config.szRedisIP, config.szPwd);
            redis_sub_array[idx].subscribe("__keyevent@0__:expired"); 
            redis_sub_array[idx].on('message', function(channel,message){
                _.onMessage(redis_sub_array[idx], channel, message);
            });
        }, function(err){
        });
    }else{
        console.error("fail to load redis config file %s", 'config/redis.json');
    }
    let length = redis_define.type.length;    
    redis_define.type.sort(function(a, b){
        return a.iType - b.iType;
    });
    _.output("redis type init");
    if(console.traceOptions){
        console.traceOptions.always = false;
    }
    _.output('---------------------------------------------------------------------------------------------------------------------------------------');
    _.output('|           name           | ID |  TIMEOUT  ||           name           | ID |  TIMEOUT  ||           name           | ID |  TIMEOUT  |');
    _.output('---------------------------------------------------------------------------------------------------------------------------------------');
    let iLast = 0;
    for(let i=0; i!=length; ++i){
        let iType = redis_define.type[i].iType;
        redis_type[iType] = {};
        let type = redis_define.type[i];
        redis_type[iType].Pre = type.szPre;
        redis_type[iType].TIMEOUT = type.TIMEOUT;
        if(type.TIMEOUT)
            assert(type.TIMEOUT >= 3, util.format("key type %s TIMEOUT MUST >= 3", iType));
        redis_type[iType].FRESH = type.FRESH;
        redis_type[iType].iIndex = type.iIndex;
        redis_type[iType].EXPIRE_ALL = type.EXPIRE_ALL;
        if(typeof type.TIMEOUT != 'undefined'){
            if(typeof type.FRESH == 'undefined'){
                redis_type[iType].FRESH = 1;
            }
        }
        if(i % 3 === 0 && i > 0){
            iLast = i;
            _.output('|%s|%s|%s||%s|%s|%s||%s|%s|%s|',
            S(redis_define.type[i-3].szPre).pad(26).s, S(''+redis_define.type[i-3].iType).pad(4).s, S(''+redis_define.type[i-3].TIMEOUT).pad(11).s,
            S(redis_define.type[i-2].szPre).pad(26).s, S(''+redis_define.type[i-2].iType).pad(4).s, S(''+redis_define.type[i-2].TIMEOUT).pad(11).s,
            S(redis_define.type[i-1].szPre).pad(26).s, S(''+redis_define.type[i-1].iType).pad(4).s, S(''+redis_define.type[i-1].TIMEOUT).pad(11).s
            );
        }
    }
    let sz = '';
    for(let j=0; j!=3; ++j){
        if(redis_define.type[iLast+j]){
            sz += "|" + S(redis_define.type[iLast+j].szPre).pad(26).s+"|" + 
                S(''+redis_define.type[iLast+j].iType).pad(4).s+"|" +
                S(''+redis_define.type[iLast+j].TIMEOUT).pad(11).s + "|";
        }else{
            sz += "|" +S('').pad(26).s + "|"+S('').pad(4).s+"|"+S('').pad(11).s+"|";
        }
    }
    _.output(sz);
    _.output('---------------------------------------------------------------------------------------------------------------------------------------');
    if(console.traceOptions){
        console.traceOptions.always = true;
    }
    _.output("=============== channels start ==================");
    for(let name in redis_channel_enum){
        redis_channel_name[redis_channel_enum[name]] = name;
        redis_channel_num[redis_channel_enum[name]] = redis_channel_num_define[name];
        _.output(name);
    }
    _.output("=============== channels end ==================");
    redis_mgr.getTimers(function(info){
        if(info){
            _.output('RESTART TIMER COUNT IS %d', info.length);
            async.each(info, function(timer, callback){
                let iNow = Math.floor(new Date().getTime() / 1000);
                let obj = JSON.parse(timer);
                redis_mgr.srem2(redis_type_enum.TIMER, szTimerSetKey, JSON.stringify(obj));
                let newT = obj.n + obj.t - iNow;
                obj.t = newT;
                obj.n = iNow;
                console.log('timer from redis %d', newT);
                if(newT > 0){
                    redis_mgr.addTimer(obj.t, obj.o, obj.i);
                }else{
                    setTimeout(timerCall, 1000, obj);
                }
                callback();
            }, function(err){
            });
        }
    });
};

redis_mgr.lock = function(key, iTTL, cb){
    let szKey = _.get_name(redis_type_enum.CONFIG, key);
    let inst = _.getRedis(redis_type_enum.CONFIG);
    inst.set(szKey, '1', 'NX', 'PX', iTTL, function(err, result){
        cb(err, result);
    });
};

redis_mgr.publish = function(szChannel, obj){
    return redis_array[0].publish(szChannel, JSON.stringify(obj));
};


redis_mgr.setnx2 = function(iType, key, value, cb){
    let inst = _.getRedis(iType);
    inst.setnx(key, JSON.stringify(value), cb);
    redis_mgr.expire2(iType, key);
};

redis_mgr.set2 = function(iType, key, value, cb){
    _.getRedis(iType).set(key, JSON.stringify(value), cb);
    redis_mgr.expire2(iType, key);
};

redis_mgr.hkeys = function (iType, key, cb) {
    _.getRedis(iType).hkeys(key, cb);
};

redis_mgr.hset = function(iType, key, field, value, cb){
    _.getRedis(iType).hset(key, field, JSON.stringify(value), cb);
    redis_mgr.expire2(iType, key);
};

redis_mgr.hsetnx = function(iType, key, field, value, cb){
    _.getRedis(iType).hsetnx(key, field, JSON.stringify(value), cb);
    redis_mgr.expire2(iType, key);
};

redis_mgr.hget = function(iType, key, field, cb){
    _.getRedis(iType).hget(key, field, function(err, res){
        if(redis_type[iType].FRESH == 1){
            redis_mgr.expire2(iType, key);
        }
        cb(err, res);
    });
};

redis_mgr.hgetall = function(iType, key, cb){
    _.getRedis(iType).hgetall(key, function(err, res){
        if(redis_type[iType].FRESH == 1){
            redis_mgr.expire2(iType, key);
        }
        cb(err, res);
    });
};

/**
 * redis HDEL命令的封装 （HDEL key field [field ...]）
 * @param iType redis_define.enum中的枚举
 * @param key 与上述枚举对应的前缀拼接为命令中的key部分
 * @param arrayField 字符串数组类型（例如["xxx", "yyy"]，对应命令中field部分，支持同时删除多个field)
 * @param cb 执行结果回调（如果删除多个field时，必须传入回调）
 */
redis_mgr.hdel= function(iType, key, arrayField, cb){
    if (typeof arrayField === 'string') {
        // 只删除1个field
        _.getRedis(iType).hdel(key, arrayField, cb);
    } else {
        if (arrayField.length === 1) {
            // 只删除1个field
            //console.log("hdel one field:%s", arrayField[0]);
            _.getRedis(iType).hdel(key, arrayField[0], cb);
        } else if (arrayField.length > 1) {
            // 同时删除多个field
            let array = [key].concat(arrayField);
            //console.log("hdel multi field:", array);
            _.getRedis(iType).hdel(array, cb);
        }
    }
};

/**
 * redis HMSET命令封装
 * @param iType redis_define.enum中的枚举
 * @param key 与上述枚举对应的前缀拼接为命令中的key部分
 * @param arrayFieldValue 字符串数组类型（例如["field1", "value1", "field2", "value2"])
 * @param cb
 */
redis_mgr.hmset= function(iType, key, arrayFieldValue, cb){
    let array = [key].concat(arrayFieldValue);
    _.getRedis(iType).hmset(array, cb);
    redis_mgr.expire2(iType, key);
};

/**
 * redis HMSET命令封装
 * @param iType redis_define.enum中的枚举
 * @param key 与上述枚举对应的前缀拼接为命令中的key部分
 * @param arrayFieldValue 字符串数组类型（例如["xxx", "yyy"]，对应命令中field部分，支持同时获取多个field的值)
 * @param cb
 */
redis_mgr.hmget= function(iType, key, arrayField, cb){
    let array = [key].concat(arrayField);
    _.getRedis(iType).hmget(array, cb);
};

redis_mgr.del2 = function(iType, key, cb){
    _.getRedis(iType).del(key, cb);
};

redis_mgr.keys = function(iType, key, cb){
    let inst = _.getRedis(iType);
    inst.keys(key, function(err, rows){
        if(err){
            cb(err);
        }else{
            let iLen = rows.length;
            for(let i=0; i!=iLen; ++i){
                rows[i] = rows[i].replace(redis_type[iType].Pre + "_", "");
            }
            cb(null, rows);
        }
    });
};

redis_mgr.get2 = function(iType, key, cb){
    let inst = _.getRedis(iType);
    inst.get(key, function(err, res){
        if(redis_type[iType].FRESH == 1){
            redis_mgr.expire2(iType, key);
        }
        if(cb){
            if(res){
                cb(err, JSON.parse(res));
            }else{
                cb(err, null);
            }
        }
    });
};

redis_mgr.incr2 = function(iType, key, cb){
    return redis_mgr.incrby(iType, key, 1, cb);
};

redis_mgr.incrby = function(iType, key, iNum, cb){
    let inst = _.getRedis(iType);
    if(redis_type[iType].TIMEOUT){
        async.waterfall([
            function(callback){
                callback();
                /*
                inst.ttl(key, function(err, result){
                    if(result == -1){
                        console.error('timeout key %s is -1', key);
                        inst.del(key);
                    }
                    callback();
                });
                */
            },function(callback){
                /*jshint ignore:start*/
                if(redis_type[iType].Func && typeof redis_type[iType].Func == "function"){
                    let exKey = _.expireKey(iType, key);
                    inst.eval(_.atomic_incrby_cb, 0, key, redis_type[iType].TIMEOUT, iNum, exKey, function(err, res){
                        callback(err, res);
                    });
                }else{
                    inst.eval(_.atomic_incrby, 0, key, redis_type[iType].TIMEOUT, iNum, function(err, res){
                        callback(err, res);
                    });
                }
                /*jshint ignore:end*/
            }
        ],function(err, res){
            cb(err, res);
        });
    }else{
        inst.incrby(key, iNum, function(err, res){
            cb(err, JSON.parse(res));
        });
    }
};

redis_mgr.decr2 = function(iType, key, cb){
    return redis_mgr.incrby(iType, key, -1, cb);
};

/*
 * @param arrayKeyValue 字符串数组类型（例如["key1", "value1", "key2", "value2"])
 */
redis_mgr.mset = function(iType, arrayKeyValue, cb){
    let newArray = [];
    for (let i=0; i<arrayKeyValue.length; i+=2){
        if(_.checkKey(arrayKeyValue[i])){
            assert(false, util.format("redis mset (iType: %d) recv null key:%s", iType, arrayKeyValue[i]));
        }
        let newName = _.get_name(iType, arrayKeyValue[i]);
        let value = arrayKeyValue[i+1];
        if(redis_type[iType].FRESH == 1){
            redis_mgr.expire2(iType, newName);
        }
        newArray.push(newName);
        newArray.push(value);
    }
    _.getRedis(iType).mset(newArray, function(err, res){
        cb(err, res);
    });
};


redis_mgr.mget = function(iType, array, cb){
    let newArray = [];
    for(let name in array){
        if(_.checkKey(array[name])){
            assert(false, util.format("redis mget (iType: %d) recv null key:%s", iType, array[name]));
        }
        let newName = _.get_name(iType, array[name]);
        if(redis_type[iType].FRESH == 1){
            redis_mgr.expire2(iType, newName);
        }
        newArray.push(newName); 
    }
    _.getRedis(iType).mget(newArray, function(err, res){
        cb(err, res);
    });
};

redis_mgr.rpush2 = function(iType, key, value, cb){
    return _.getRedis(iType).rpush(key, value, cb);
};

redis_mgr.rpush2Expire = function(iType, key, value, cb){
    _.getRedis(iType).rpush(key, value, cb);
    redis_mgr.expire2(iType, key);
};

redis_mgr.zrevrange2 = function(iType, key, srank, erank, cb){
    _.getRedis(iType).zrevrange(key, srank, erank, 'withscores', cb);
};

redis_mgr.sadd2 = function(iType, key, value, cb){
    _.getRedis(iType).sadd(key, value, cb);
    redis_mgr.expire2(iType, key);
};

// cb(err, [0/1, realSize])
// 0: out of limit
// 1: value added or exist
redis_mgr.sadd2WithLimit = function(iType, key, value, iLimit, cb){
    let evalParamsArr = [
        _.atomic_sadd_with_limit,
        1,
        key,
        value,
        iLimit,
    ];
    _.getRedis(iType).eval(evalParamsArr, cb);
};

redis_mgr.srem2 = function(iType, key, value, cb){
    return _.getRedis(iType).srem(key, value, cb);
};

redis_mgr.smembers2 = function(iType, key, cb){
    _.getRedis(iType).smembers(key, cb);
};

redis_mgr.sismember2 = function(iType, key, value, cb){
    _.getRedis(iType).sismember(key, value, cb);
};

redis_mgr.scard2 = function(iType, key, cb){
    _.getRedis(iType).scard(key, cb);
};

redis_mgr.spop2 = function(iType, key, cb){
    _.getRedis(iType).spop(key, cb);
};

// redis version > 3.2 spop才支持一次pop多个，这里折中一下：先srandmember取出，再srem删除
redis_mgr.spopmulti2 = function(iType, key, iCount, cb){
    _.getRedis(iType).srandmember(key, iCount, function(err, arr) {
        if (!err && arr.length > 0) {
            _.getRedis(iType).srem(key, arr, function(err) {
                cb(err, arr);
            });
        } else {
            cb(err, arr);
        }
    });
};

redis_mgr.srandmember2 = function(iType, key, iCount, cb){
    _.getRedis(iType).srandmember(key, iCount, cb);
};

redis_mgr.zadd2 = function(iType, key, score, member, cb){
    _.getRedis(iType).zadd(key, score, member, cb);
    redis_mgr.expire2(iType, key);
};

redis_mgr.zaddarr2 = function(iType, key, array, cb){
    array = [key].concat(array);
    _.getRedis(iType).zadd(array, cb);
    redis_mgr.expire2(iType, key);
};

redis_mgr.zincrby2 = function(iType, key, score, member, cb){
    _.getRedis(iType).zincrby(key, score, member, cb);
    redis_mgr.expire2(iType, key);
};

redis_mgr.zscore2 = function(iType, key, member, cb){
    _.getRedis(iType).zscore(key, member, cb);
};

redis_mgr.zcard2 = function(iType, key,cb){
    _.getRedis(iType).zcard(key,cb);
};

redis_mgr.zrevrank2 = function(iType, key, member, cb){
    _.getRedis(iType).zrevrank(key, member, cb);
};

redis_mgr.zrem2 = function(iType, key, member, cb){
    _.getRedis(iType).zrem(key, member, cb);
};

redis_mgr.zremrangebyrank2 = function(iType, key, start, end, cb){
    _.getRedis(iType).zremrangebyrank(key, start, end, cb);
};

redis_mgr.zrangebyscore2 = function(iType, key, iMin, iMax, cb){
    _.getRedis(iType).zrangebyscore(key, iMin, iMax, cb);
};

redis_mgr.zpop2 = function(iType, key, iMin, iMax, cb){
    let evalParamsArr = [
        _.atomic_zpop,
        1,
        key,
        iMin,
        iMax,
    ];
    _.getRedis(iType).eval(evalParamsArr, cb);
};

redis_mgr.ltrim = function(iType, key, iStart, iStop, cb){
    _.getRedis(iType).ltrim(key, iStart, iStop, cb);
};

redis_mgr.lpop2 = function(iType, key, cb){
    _.getRedis(iType).lpop(key, cb);
};

redis_mgr.lpush2 = function(iType, key, value, cb){
    _.getRedis(iType).lpush(key, value, cb);
};

redis_mgr.llen = function(iType, key, cb){
    _.getRedis(iType).llen(key, cb);
};

redis_mgr.lrange = function(iType, key, iStart, iEnd, cb){
    _.getRedis(iType).lrange(key, iStart, iEnd, cb);
};

redis_mgr.lremall = function(iType, key, value, cb){
    _.getRedis(iType).lrem(key, 0, value, cb);
};

module.exports = redis_mgr;
