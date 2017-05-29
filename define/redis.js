let redis_define = {};


let redis_type_enum = {};
redis_type_enum.EXAMPLE = 1; //redis使用实例
redis_type_enum.TIMER = 2; //用于落地存储进程定时器的key
redis_type_enum.CONFIG = 3; //存放需要动态设置的KEY

//TIMEOUT 配置该类型的key查实时间，单位为s
//iIndex 配置使用的redis实例号
//FRESH 每次命中key时是否更新过期时间 0 不更新 1 更新
let redis_type = [
    {
        iType : redis_type_enum.EXAMPLE,
        szPre : "EXAMPLE",
        TIMEOUT: 86400,
        iIndex : 1, 
        FRESH: 0
    },
    {
        iType : redis_type_enum.TIMER,//用来存储Timer的辅助数据
        szPre : "__TIMER_",
    },
    {
        iType : redis_type_enum.CONFIG,//用来存放各种需要动态修改的配置
        szPre : "CONFIG",
    }
];

//redis定时器定义
let redis_timer_enum = Object.freeze({
    'EXAMPLE':0,
});

//redis进程间通信通道定义
let redis_channel_enum = Object.freeze({
    'CHANNEL_NAME':0,
});

//表示这个channel对应的接收端有几个,名字必须与上面的相等
//个数表示接收者有几个
//接收的进程，第一个参数需要传一个ID，例如3个接受者为0 1 2
//如果配置为-1，就是说接收者不再是负载均衡的角色，这个时候channel的定义是广播
let redis_channel_num_define = Object.freeze({
    'CHANNEL_NAME':-1,
});

redis_define.enum = redis_type_enum;
redis_define.type = redis_type;
redis_define.timer = redis_timer_enum;
redis_define.redis_channel_enum = redis_channel_enum;
redis_define.redis_channel_num_define = redis_channel_num_define;

module.exports.redis_define = redis_define;
