exports.handler = async function() {
    try {
      const builtinModules = getBuiltinModules();
      const installedModules = await getInstalledModules();

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify({
          runtime: {
            node: process.version,
            platform: process.platform,
            arch: process.arch
          },
          modules: {
            builtin: builtinModules,
            installed: installedModules
          }
        }, null, 2)
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Failed to retrieve modules information",
          message: error.message,
          stack: error.stack
        })
      };
    }
  };

  // Получение встроенных модулей Node.js
  function getBuiltinModules() {
    try {
      // Для Node.js >=8.9.0
      const builtins = require('module').builtinModules;

      if (builtins) {
        const modules = {};

        for (const name of builtins) {
          try {
            const mod = require(name);
            modules[name] = {
              version: mod.version || 'Built-in',
              description: getModuleDescription(mod, name)
            };
          } catch (err) {
            modules[name] = {
              error: `Could not load: ${err.message}`,
              available: false
            };
          }
        }

        return modules;
      }
    } catch (error) {
      // Альтернативный метод для старых версий Node.js
      return { error: "Could not get builtin modules list", message: error.message };
    }

    // Ручной список основных модулей, если автоматический метод не сработал
    return ['fs', 'path', 'http', 'https', 'os', 'crypto', 'util', 'events', 'stream',
            'buffer', 'querystring', 'url', 'zlib'].reduce((acc, name) => {
      try {
        const mod = require(name);
        acc[name] = {
          version: mod.version || 'Built-in',
          description: getModuleDescription(mod, name)
        };
      } catch (err) {
        acc[name] = { error: err.message, available: false };
      }
      return acc;
    }, {});
  }

  // Попытка найти описание модуля
  function getModuleDescription(mod, name) {
    if (!mod) return 'No description available';

    // Попытка найти описание в разных местах
    if (mod.description) return mod.description;
    if (typeof mod === 'object' && mod.constructor && mod.constructor.description)
      return mod.constructor.description;

    // Для некоторых известных модулей добавим описание вручную
    const descriptions = {
      'fs': 'File system operations',
      'path': 'Path manipulation utilities',
      'http': 'HTTP server and client',
      'https': 'HTTPS server and client',
      'os': 'Operating system related utilities',
      'crypto': 'Cryptographic functionality',
      'util': 'Utility functions',
      'events': 'Event emitter implementation',
      'stream': 'Stream implementation',
      'buffer': 'Binary data handling',
      'querystring': 'Parse and stringify URL query strings',
      'url': 'URL parsing and resolution',
      'zlib': 'Compression functionality'
    };

    return descriptions[name] || 'No description available';
  }

  // Получение установленных NPM модулей
  async function getInstalledModules() {
    try {
      const fs = require('fs');
      const path = require('path');
      const util = require('util');
      const readdir = util.promisify(fs.readdir);
      const readFile = util.promisify(fs.readFile);
      const stat = util.promisify(fs.stat);

      // Проверяем наличие node_modules в разных местах
      const possiblePaths = [
        '/var/task/node_modules',  // AWS Lambda
        process.cwd() + '/node_modules',
        path.resolve(__dirname, '../../node_modules')
      ];

      let modulesPath = null;

      // Найти первый существующий путь к node_modules
      for (const p of possiblePaths) {
        try {
          await stat(p);
          modulesPath = p;
          break;
        } catch (e) {
          // Путь не существует, проверяем следующий
        }
      }

      if (!modulesPath) {
        return { error: 'No node_modules directory found' };
      }

      const modules = {};

      // Получить все директории в node_modules
      let dirs = await readdir(modulesPath);

      // Фильтруем, чтобы исключить скрытые файлы и специальные директории
      dirs = dirs.filter(dir => !dir.startsWith('.') && !dir.startsWith('@'));

      // Добавляем также scoped packages (@org/package)
      for (const dir of dirs.filter(dir => dir.startsWith('@'))) {
        try {
          const scopedPath = path.join(modulesPath, dir);
          const scopedDirs = await readdir(scopedPath);
          dirs = dirs.concat(scopedDirs.map(scopedDir => `${dir}/${scopedDir}`));
        } catch (e) {
          // Ошибка чтения директории со scoped packages
        }
      }

      // Получаем информацию о каждом модуле
      for (const dir of dirs) {
        try {
          // Пропускаем служебные файлы и директории
          if (dir.startsWith('.') || dir === 'node_modules') continue;

          const packageJsonPath = path.join(modulesPath, dir, 'package.json');

          try {
            const packageJsonContent = await readFile(packageJsonPath, 'utf8');
            const packageInfo = JSON.parse(packageJsonContent);

            modules[dir] = {
              version: packageInfo.version || 'Unknown',
              description: packageInfo.description || 'No description available',
              author: packageInfo.author ?
                     (typeof packageInfo.author === 'string' ?
                     packageInfo.author : packageInfo.author.name) : 'Unknown',
              license: packageInfo.license || 'Not specified'
            };
          } catch (err) {
            // Не удалось прочитать package.json
            modules[dir] = {
              available: true,
              error: `Cannot read package.json: ${err.message}`
            };
          }
        } catch (err) {
          // Пропускаем директории, которые вызывают ошибки
        }
      }

      // Проверка некоторых популярных модулей Netlify для серверных функций
      const commonNetlifyModules = [
        '@netlify/functions',
        'netlify-lambda',
        '@sendgrid/mail',
        'mongodb',
        'faunadb',
        'axios',
        'node-fetch',
        'aws-sdk'
      ];

      for (const moduleName of commonNetlifyModules) {
        if (!modules[moduleName]) {
          try {
            require.resolve(moduleName);
            modules[moduleName] = {
              available: true,
              note: 'Available but no package.json found'
            };
          } catch (e) {
            // Модуль недоступен
          }
        }
      }

      return modules;

    } catch (error) {
      return { error: "Failed to retrieve installed modules", message: error.message };
    }
  }