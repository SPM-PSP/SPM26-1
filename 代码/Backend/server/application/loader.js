const path = require('path');
const fs = require('fs');
const Router = require('koa-router');
const chalk = require('chalk');
const { errorLogger } = require('../../common/log4');

function getFileStat(filePath) {
  try {
    fs.statSync(filePath);
    return true;
  } catch (err) {
    return false;
  }
}

function scanFilesByFolder(dir, cb) {
  const folder = path.resolve(__dirname, dir);
  if (!getFileStat(folder)) {
    return;
  }
  try {
    const files = fs.readdirSync(folder);
    files.forEach((file) => {
      if (file.match(/.DS/) || file.match(/._v/) || file.match(/._/)) {
        return;
      }
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(path.join(__dirname, fullPath));
      if (stat.isDirectory()) {
        scanFilesByFolder(path.join(dir, file), cb);
      }
      if (!file.match(/js/)) {
        return;
      }
      const filename = file.replace('.js', '');
      const fileContent = require(folder + '/' + filename);
      if (typeof fileContent === 'function' && cb) {
        cb(filename, fileContent);
      }
    });
  } catch (error) {
    errorLogger.error('auto load file failed', error);
    console.log('auto load file failed', error);
  }
}

function getDbConfig(config) {
  if (config.mysql) {
    let dbConfig = config.mysql.local || config.mysql;
    if (process.env.DB_ENV === 'development' && config.mysql.dev) {
      dbConfig = config.mysql.dev;
    }
    if (process.env.NODE_ENV === 'production' && config.mysql.prd) {
      dbConfig = config.mysql.prd;
    }
    return {
      host: dbConfig.host || dbConfig.servername || '127.0.0.1',
      port: dbConfig.port || 3306,
      database: dbConfig.database || 'lrs',
      user: dbConfig.user || 'root',
      pass: dbConfig.pass || '',
      timezone: dbConfig.timezone || '+08:00',
      logSql: dbConfig.logSql,
      sync: !!dbConfig.sync,
      alter: !!dbConfig.alter,
    };
  }

  // Backward-compatible fallback to old key name.
  const old = config.mysqldb || {};
  let dbConfig = old.local || {};
  if (process.env.DB_ENV === 'development' && old.dev) {
    dbConfig = old.dev;
  }
  if (process.env.NODE_ENV === 'production' && old.prd) {
    dbConfig = old.prd;
  }
  return {
    host: dbConfig.host || dbConfig.servername || '127.0.0.1',
    port: dbConfig.port || 3306,
    database: dbConfig.database || 'lrs',
    user: dbConfig.user || 'root',
    pass: dbConfig.pass || '',
    timezone: '+08:00',
    logSql: false,
    sync: false,
    alter: false,
  };
}

const initConfig = function () {
  let config = {};
  const projectConfig = require('../../config.json');
  config = { ...config, ...projectConfig };
  return config;
};

const initConstants = function () {
  return require('../../common/constants');
};

const initErrorCode = function () {
  return require('../../common/errorCode');
};

const initController = function (app) {
  let controllers = {};
  scanFilesByFolder('../controller', (filename, controller) => {
    controllers[filename] = controller(app);
  });
  return controllers;
};

const initRouter = function (app) {
  const router = new Router();
  require('../routes')({ ...app, router });
  return router;
};

function initService(app) {
  let services = {};
  scanFilesByFolder('../service', (filename, service) => {
    services[filename] = service(app);
  });
  return services;
}

function initMysqlModel(app) {
  const { Sequelize, DataTypes } = require('sequelize');
  const { commonLogger, mysqldbLogger } = app.$log4;
  const dbConfig = getDbConfig(app.$config);

  const sequelize = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.pass, {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'mysql',
    timezone: dbConfig.timezone,
    dialectOptions: {
      decimalNumbers: true,
    },
    logging: dbConfig.logSql === false ? false : (sql) => mysqldbLogger.info(sql),
  });

  commonLogger.info(`mysql init: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

  let model = {};
  scanFilesByFolder('../mysqlModel', (filename, modelFactory) => {
    model[filename] = modelFactory(sequelize, DataTypes);
  });

  app.$sequelize = sequelize;
  app.$db = sequelize;
  app.$dbConfig = dbConfig;
  return model;
}

function initExtend(app) {
  scanFilesByFolder('../extend', (filename, extendFn) => {
    app['$' + filename] = Object.assign(app['$' + filename] || {}, extendFn(app));
  });
}

function initMysqldb(app) {
  const { commonLogger, errorLogger } = app.$log4;
  const sequelize = app.$sequelize;

  sequelize
    .authenticate()
    .then(() => {
      commonLogger.info('mysql connect success');
      console.log(chalk.green('============== mysql connect success ================='));
    })
    .catch((error) => {
      commonLogger.error('mysql connect failed: ' + error);
      errorLogger.error('mysql connect failed: ' + error);
      console.log(chalk.red('mysql connect failed: ' + error));
    });

  if (app.$dbConfig && app.$dbConfig.sync) {
    sequelize
      .sync({ alter: !!app.$dbConfig.alter })
      .then(() => {
        commonLogger.info('sequelize sync success');
      })
      .catch((error) => {
        commonLogger.error('sequelize sync failed: ' + error);
        errorLogger.error('sequelize sync failed: ' + error);
      });
  }
}

function initMiddleware(app) {
  let middleware = {};
  scanFilesByFolder('../middleware', (filename, middlewareConf) => {
    middleware[filename] = middlewareConf(app);
  });
  return middleware;
}

function initLog4() {
  return require('../../common/log4');
}

function initNodeCache() {
  const NodeCache = require('node-cache');
  return new NodeCache();
}

function initSchedule(app) {
  const schedule = require('node-schedule');
  const { commonLogger } = app.$log4;
  let schedules = {};
  scanFilesByFolder('../schedule', (filename, scheduler) => {
    if (scheduler(app).open) {
      schedules[filename] = schedule.scheduleJob(scheduler(app).interval, scheduler(app).handler);
      commonLogger.info('scheduler start: ' + filename);
    } else {
      commonLogger.info('scheduler disabled: ' + filename);
    }
  });
  return schedules;
}

const initWs = function () {
  const ws = require('nodejs-websocket');
  const server = ws
    .createServer(function (connection) {
      connection.on('text', function (str) {
        console.log('Received ' + str);
        connection.sendText(str.toUpperCase() + '!!!');
      });
      connection.on('close', function (code, reason) {
        console.log('Connection closed');
        console.log(code, reason);
      });
      connection.on('error', function (code, reason) {
        console.log(code, reason);
      });
    })
    .listen(6003);
  return server;
};

module.exports = {
  initController,
  initRouter,
  initMiddleware,
  initService,
  initConfig,
  initLog4,
  initNodeCache,
  initExtend,
  initMysqlModel,
  initMysqldb,
  initSchedule,
  initConstants,
  initErrorCode,
  initWs,
};
