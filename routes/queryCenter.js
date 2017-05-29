
let queryCenter = {};
module.exports = queryCenter;

let _ = {};

let routesMap = {};
queryCenter.initRouterDefine = function (routeDefineList) {
    routeDefineList.forEach(function (routeObj) {
        routesMap[routeObj.router] = routeObj;

        if(routeObj.restful === 1){
            //生成匹配正则表达式
            let pathArray = routeObj.router.split('\/');
            let pattString = "^";
            for(let i in pathArray){
                if(pathArray[i].length > 0){
                    if(pathArray[i][0] === ":"){
                        pattString = pattString + "\/(?:([^\/]+?))";
                    }else{
                        pattString = pattString + "\/" + pathArray[i];
                    }
                }
            }
            pattString = pattString + "\/?$";
            routeObj.pattString = pattString;
        }

        // url cache初始化
        if (routeObj.cache && routeObj.cache === 1) {
            // 该接口开启了url缓存
            if (routeObj.delEventEnum && routeObj.delEventEnum.length > 0) {
                _.addDelEvent(routeObj);
            }
        }
    });
};

queryCenter.getRouterDefine = function (szRouter) {
    for(let i in routesMap){
        if(i === szRouter){
            return routesMap[i];
        }else{
            if(routesMap[i].restful === 1){
                var pattern = new RegExp(routesMap[i].pattString, "i");
                if(pattern.exec(szRouter)){
                    return routesMap[i];
                }
            }
        }
    }
    return undefined;
};

// 配置了让缓存模块监听事件，进行url缓存删除的接口（事件名->接口信息）
_.delEvent2RouterMap = {};

_.buildCacheObj = function (queryObj) {
    let cacheObj = {
        router : queryObj.router,
        cache : queryObj.cache,
        cacheTime : queryObj.cacheTime,
        keyParams : queryObj.keyParams,
    };
    return cacheObj;
};

_.addRouter2EventMap = function (szEventName, queryObj, eventMap) {
    //console.log("addRouter2EventMap(%s, %s)", szEventName, queryObj.router);
    if (szEventName in eventMap) {
        // 已经存在该事件
        if (!(queryObj.router in eventMap[szEventName].szRouterMap)) {
            // 且该事件下没有添加过这个router
            eventMap[szEventName].queryList.push(_.buildCacheObj(queryObj));
            eventMap[szEventName].szRouterMap[queryObj.router] = 1;
        }
    }
    else {
        // 首次遇到该事件
        eventMap[szEventName] = {
            szEventName : szEventName,
            queryList : [_.buildCacheObj(queryObj)],
            szRouterMap : {},
        };
        eventMap[szEventName].szRouterMap[queryObj.router] = 1;
    }
};

_.addDelEvent = function (queryObj) {
    queryObj.delEventEnum.forEach(function (szEventName) {
        _.addRouter2EventMap(szEventName, queryObj, _.delEvent2RouterMap);
    });
};

queryCenter.getAllDelEventMap = function () {
    return _.delEvent2RouterMap;
};

queryCenter.getQueryObjListViaEvent = function (szEventName) {
    if (szEventName in _.delEvent2RouterMap) {
        return _.delEvent2RouterMap[szEventName].queryList;
    }
    else {
        return [];
    }
};
