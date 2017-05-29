/*
 *  * 这个文件定义各种错误的含义
 *   */

const path = require('path');
const global_config = require(path.join(global.rootPath, 'config/global_conf')).global_config;

let msg = {};
msg.define = {};
msg.code = {};

/**
 *  * 错误枚举
 *   * @type {number}
 *    */
msg.code.ERR_SUCCESS = 0; // success
//-100xxx  系统通用错误码
msg.code.ERR_SYS_ERR = -100000; // 服务器内部错误，请联系客服
msg.code.ERR_INVALID_PARAM = -100001; // 不合法的参数
msg.code.ERR_404_ROUTER = -100002; // 未定义的接口

/**
*  * 错误信息
*   * @type {string}
*    */
msg.define[msg.code.ERR_SUCCESS] = "success";
msg.define[msg.code.ERR_SYS_ERR] = "服务器内部错误，请联系客服";
msg.define[msg.code.ERR_INVALID_PARAM] = "不合法的参数";
msg.define[msg.code.ERR_404_ROUTER] = "未定义的接口";

msg.getMsg = function(code, result) {
    let obj = {};
    obj.ret = code;
    obj.msg = msg.define[code];
    if (typeof result !== 'undefined' && result !== null) {
        obj.result = result;
    }
    return obj;
};

msg.wrapper = function(err, result, res) {
    //测试环境配置成允许跨域访问
    if (global_config.iAllowCrossAccess === 1) {
        res.header("Access-Control-Allow-Origin", "*");
    }
    if (err) {
        if (msg.define[err]) {
            res.jsonp(msg.getMsg(err, result));
        } else {
            res.jsonp(msg.getMsg(msg.code.ERR_SYS_ERR, result));
        }
    } else {
        res.jsonp(msg.getMsg(msg.code.ERR_SUCCESS, result));
    }
};


module.exports = msg;
