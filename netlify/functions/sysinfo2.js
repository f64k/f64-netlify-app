const os = require('os');

exports.handler = async function () {
    try {
        // Объект для сбора всей информации о системе
        const systemInfo = {
            timestamp: new Date().toISOString(),
            platform: {
                type: safeGet(() => os.type()),
                platform: safeGet(() => os.platform()),
                release: safeGet(() => os.release()),
                architecture: safeGet(() => os.arch()),
                endianness: safeGet(() => os.endianness()),
                uptime: safeGet(() => formatUptime(os.uptime())),
            },
            cpu: {
                model: safeGet(() => os.cpus()[0]?.model || 'Unknown'),
                cores: safeGet(() => os.cpus().length),
                speed: safeGet(() => `${os.cpus()[0]?.speed || 0} MHz`),
                loadAvg: safeGet(() => os.loadavg()),
            },
            memory: {
                total: safeGet(() => formatBytes(os.totalmem())),
                free: safeGet(() => formatBytes(os.freemem())),
                usedPercent: safeGet(() => Math.round((1 - os.freemem() / os.totalmem()) * 100)),
            },
            network: {
                hostname: safeGet(() => os.hostname()),
                interfaces: safeGet(() => simplifyNetworkInterfaces(os.networkInterfaces())),
            },
            process: {
                pid: safeGet(() => process.pid),
                nodeVersion: safeGet(() => process.version),
                memoryUsage: safeGet(() => {
                    const mem = process.memoryUsage();
                    return {
                        rss: formatBytes(mem.rss),
                        heapTotal: formatBytes(mem.heapTotal),
                        heapUsed: formatBytes(mem.heapUsed),
                        external: formatBytes(mem.external || 0),
                    };
                }),
                env: safeGet(() => ({
                    NODE_ENV: process.env.NODE_ENV,
                    NETLIFY: process.env.NETLIFY,
                    CONTEXT: process.env.CONTEXT,
                    DEPLOY_URL: process.env.DEPLOY_URL,
                })),
            }
        };

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache"
            },
            body: JSON.stringify(systemInfo, null, 2)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to retrieve system information", message: error.message })
        };
    }
};

// Вспомогательная функция для безопасного получения значений
function safeGet(fn) {
    try {
        return fn();
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

// Форматирование байтов в читаемый вид
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Форматирование времени работы системы
function formatUptime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

// Упрощение информации о сетевых интерфейсах
function simplifyNetworkInterfaces(interfaces) {
    const result = {};
    try {
        for (const [name, infos] of Object.entries(interfaces)) {
            result[name] = infos.map(info => ({
                family: info.family,
                address: info.address,
                internal: info.internal
            }));
        }
    } catch (error) {
        return `Error processing network interfaces: ${error.message}`;
    }
    return result;
}