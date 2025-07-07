// netlify/functions/sysinfo.js
const os = require('os');

function safe(name, fn) {
    try {
        return fn();
    } catch (e) {
        return `error: ${e.message}`;
    }
}

exports.handler = async () => {
    const info = {
        platform: safe('platform', () => os.platform()),
        arch: safe('arch', () => os.arch()),
        cpus: safe('cpus', () => {
            let c = os.cpus();
            return Array.isArray(c) ? c.map(x => ({
                model: x.model,
                speed: x.speed,
            })) : c;
        }),
        cpu_count: safe('cpu_count', () => os.cpus().length),
        total_mem: safe('total_mem', () => os.totalmem()),
        free_mem: safe('free_mem', () => os.freemem()),
        uptime: safe('uptime', () => os.uptime()),

        // Новое в Node 18+: обратный вызов ошибки, если, например, недоступно
        user_info: safe('user_info', () => os.userInfo()),
        loadavg: safe('loadavg', () => os.loadavg()),
        hostname: safe('hostname', () => os.hostname()),
        release: safe('release', () => os.release()),
        network: safe('network', () => os.networkInterfaces()),
    };
    return {
        statusCode: 200,
        body: JSON.stringify(info, null, 2)
    };
}