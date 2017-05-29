/* jshint node:true*/
"use strict";

const express = require('express');
const router = express.Router();
const joi = require('joi');
const path = require('path');
const msg = require(path.join(global.rootPath, "define/msg"));

router.use(function(req, res, next){
    let routeDefine = queryCenter.getRouterDefine(req.path);
    if (routeDefine) {
        let params = req.urlParams;

        let validateOpt = {
            stripUnknown : true,    // 移除未定义的参数
        };
        joi.validate(params, routeDefine.params, validateOpt, function (err, value) {
            if (err) {
                console.error("have invalid param: ", err.details);
                console.error("input params is: ", value);
                msg.wrapper(msg.code.ERR_INVALID_PARAM, err.details, res);
                return;
            }
            //切换成joi过滤后的参数，joi自动完成了类型转换
            req.urlParams = value;
            next();
        });
    }
    else {
        // 未定义的接口
        msg.wrapper(msg.code.ERR_404_ROUTER, null, res);
    }
});

module.exports = router;
