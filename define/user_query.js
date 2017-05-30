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
	szPhone : joi.string().required(),
	szSignature : joi.string(),
	szArea : joi.string().required(),
	szPrice : joi.string().required(),
	szType : joi.string().required(),
	szFreeTime : joi.string().required(),
    },
    post:1,
    limit:500,
    comment:"添加教师接口",
},
{
    router:"/user/teacher/list",
    params:{
	iStart : joi.number().integer().required(),
	iNum : joi.number().integer().required(),
    },
    limit:500,
    comment:"教师列表接口",
},
{
    router:"/user/school/add",
    params:{
	szName : joi.string().required(),
	szContactsName : joi.string().required(),
	szContactsWe : joi.string().required(),
	szContactsPhone : joi.string().required(),
	szContactsMail : joi.string().required(),
	szSchoolDesc : joi.string().required(),
	szArea : joi.string().required(),
	szType : joi.string().required(),
	szCourseTime : joi.string().required()
    },
    post:1,
    limit:500,
    comment:"添加学校接口",
},
{
    router:"/user/school/list",
    params:{
	iStart : joi.number().integer().required(),
	iNum : joi.number().integer().required(),
    },
    limit:500,
    comment:"学校列表接口",
}
];
