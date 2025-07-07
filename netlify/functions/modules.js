const path = require('path');
const fs = require('fs');

exports.handler = async () => {
    // Список встроенных модулей Node.js
    const builtins = [];
    try {
        const native = require('module').builtinModules;
        for (const name of native) {
            builtins.push({
                name,
                description: `Built-in Node.js module`
            });
        }
    } catch (e) { /* ничего */ }

    // Список установленных модулей из package.json
    let installed = [];
    try {
        const pkg = require(path.resolve('./package.json'));
        const deps = Object.keys(pkg.dependencies || {});
        installed = deps.map(dep => {
            let desc = '';
            try {
                const depPkg = require(path.join(dep, 'package.json'));
                desc = depPkg.description || '';
            } catch (e) {
                desc = 'No description';
            }
            return { name: dep, description: desc };
        });
    } catch (e) { /* нет package.json или deps */ }

    return {
        statusCode: 200,
        body: JSON.stringify({
            builtinModules: builtins,
            installedModules: installed
        }, null, 2)
    };
};