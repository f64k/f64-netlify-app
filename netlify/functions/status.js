// netlify/functions/status.js
exports.handler = async () => {
    const now = new Date().toISOString();
    const ram = process.memoryUsage().rss;
    return {
        statusCode: 200,
        body: JSON.stringify({ now, ram })
    };
};