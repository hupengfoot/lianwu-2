const express = require('express');
const router = express.Router();
const query = require('querystring');
const formidable = require('formidable');
const util = require('util');

//转换post数据统一到URL中
router.use(function(req, res, next){
    if(req.method == 'POST'){
        let paramsList = [];

        //for firefox 
        if((req.get('Content-Type') && req.get('Content-Type').indexOf('application/x-www-form-urlencoded') > -1)){
            for(let szQ in req.body){
                if(szQ.length > 0){
                    //req.url += "&" + szQ + "=" + encodeURIComponent(req.body[szQ]);
                    req.query[szQ] = (req.body[szQ]);
                    paramsList.push(util.format("%s=%s", szQ, encodeURIComponent(req.body[szQ])));
                }
            }
            if (paramsList.length > 0) {
                let allQueryString = paramsList.join('&');
                if(req.url.indexOf('?') === -1){
                    req.url += "?" + allQueryString;
                }
                else {
                    req.url += "&" + allQueryString;
                }
            }
            next();
        }else{
            let form = new formidable.IncomingForm();
            form.parse(req, function(err, fields, files){
                for(let name in fields){
                    if (name.length > 0) {
                        req.query[name] = (fields[name]);
                    }
                }
                res.locals.files=files;
                if (paramsList.length > 0) {
                    let allQueryString = paramsList.join('&');
                    if(req.url.indexOf('?') === -1){
                        req.url += "?" + allQueryString;
                    }
                    else {
                        req.url += "&" + allQueryString;
                    }
                }
                next();
            });
        }
    }else{
        next();
    }
});

module.exports = router;
