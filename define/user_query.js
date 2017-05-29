"use strict";

/*
 * limit 设置接口每秒访问次数阈值  TODO
 * post 0或不填为get接口，1为post接口
 * restful 0或不填为非restful风格接口，1为restful风格接口
 */

const joi = require('joi');
const path = require('path');
const myJoi = require(path.join(global.rootPath, 'define/joi'));

module.exports = [ 
{
    router:'/example',
    params:{
        iExampleID : joi.number().integer().min(0).required()
    },
    //@iExampleID 示例ID
    limit:500,
    comment:"接口定义示例",
},
{
    router:"/user/teacher/add",
    params:{
	szName : joi.string().required(),
	szOpenID : joi.string().required(),
	szHeadUrl : joi.string().required(),
	szSignature : joi.string().required(),
	szArea : joi.string().required(),
	iLabel : joi.number().integer().min(0),
	iPrice : joi.number().integer().min(0).required(),
	szType : joi.string().required(),
	szPhone : joi.string().required(),
	szFreeTime : joi.string().required(),
    },
    post:1,
    limit:500,
    comment:"添加教师接口",
}
];
