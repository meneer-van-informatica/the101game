// the101game — baseline schema + indexes + seed (corrected)
// Run with env: MONGODB_URI, MONGODB_DB, SEED_* (optional)

const { MongoClient } = require('mongodb');

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DBN = process.env.MONGODB_DB  || 'the101game';

const TEACHER_NAME   = process.env.SEED_TEACHER_NAME   || 'Lucas de Bruin';
const TEACHER_EMAIL  = process.env.SEED_TEACHER_EMAIL  || 'l.d.bruin@fioretti.nl';
const TEACHER_HANDLE = process.env.SEED_TEACHER_HANDLE || 'lucas';
const CLASS_NAME     = process.env.SEED_CLASS_NAME     || 'Fioretti Informatica 101';
const CLASS_CODE     = process.env.SEED_CLASS_CODE     || 'FIO101';
const CLASS_CAP      = Number(process.env.SEED_CLASS_CAP || 240);

async function ensureCollection(db, name, validator) {
  const exists = await db.listCollections({ name }).hasNext();
  if (!exists) {
    await db.createCollection(name, validator ? { validator } : undefined);
  }
  return db.collection(name);
}

(async () => {
  const client = new MongoClient(URI, { retryWrites: true });
  await client.connect();
  const db = client.db(DBN);
  const now = new Date();

  // --- Collections (light validators) ---
  const users = await ensureCollection(db, 'users', { $jsonSchema: {
    bsonType:'object', required:['handle','createdAt'],
    properties:{
      handle:{bsonType:'string'},
      email:{bsonType:['string','null']},
      name:{bsonType:['string','null']},
      roles:{bsonType:'array', items:{bsonType:'string'}},
      createdAt:{bsonType:'date'}
    }
  }});

  const devices = await ensureCollection(db, 'devices', { $jsonSchema:{
    bsonType:'object', required:['deviceId','firstSeen'],
    properties:{
      deviceId:{bsonType:'string'},
      userId:{bsonType:['objectId','null']},
      ua:{bsonType:['string','null']},
      tz:{bsonType:['string','null']},
      ipHash:{bsonType:['string','null']},
      firstSeen:{bsonType:'date'},
      lastSeen:{bsonType:'date'}
    }
  }});

  const sessions = await ensureCollection(db, 'sessions', { $jsonSchema:{
    bsonType:'object', required:['sid','createdAt'],
    properties:{
      sid:{bsonType:'string'},
      userId:{bsonType:['objectId','null']},
      deviceId:{bsonType:['string','null']},
      createdAt:{bsonType:'date'},
      lastSeen:{bsonType:'date'},
      expiresAt:{bsonType:'date'}
    }
  }});

  const classes = await ensureCollection(db, 'classes', { $jsonSchema:{
    bsonType:'object', required:['name','code','teacherId','createdAt'],
    properties:{
      name:{bsonType:'string'},
      code:{bsonType:'string'},
      teacherId:{bsonType:'objectId'},
      active:{bsonType:'bool'},
      capacity:{bsonType:'int'},
      createdAt:{bsonType:'date'}
    }
  }});

  const enrollments = await ensureCollection(db, 'enrollments', { $jsonSchema:{
    bsonType:'object', required:['classId','userId','role','joinedAt'],
    properties:{
      classId:{bsonType:'objectId'},
      userId:{bsonType:'objectId'},
      role:{bsonType:'string'},
      joinedAt:{bsonType:'date'},
      status:{bsonType:'string'}
    }
  }});

  const buddies = await ensureCollection(db, 'buddies', { $jsonSchema:{
    bsonType:'object', required:['members','createdAt','status'],
    properties:{
      members:{bsonType:'array', items:{bsonType:'objectId'}, minItems:2, maxItems:4},
      createdAt:{bsonType:'date'},
      status:{bsonType:'string'}
    }
  }});

  const parties = await ensureCollection(db, 'parties', { $jsonSchema:{
    bsonType:'object', required:['code','members','createdAt','status'],
    properties:{
      code:{bsonType:'string'},
      members:{bsonType:'array', items:{bsonType:'objectId'}},
      createdAt:{bsonType:'date'},
      status:{bsonType:'string'}
    }
  }});

  const levels = await ensureCollection(db, 'levels', { $jsonSchema:{
    bsonType:'object', required:['no','name','tests','published'],
    properties:{
      no:{bsonType:'int'},
      name:{bsonType:'string'},
      tests:{bsonType:'int'},
      rules:{bsonType:['object','null']},
      published:{bsonType:'bool'}
    }
  }});

  const progress = await ensureCollection(db, 'progress', { $jsonSchema:{
    bsonType:'object', required:['userId','level','updatedAt'],
    properties:{
      userId:{bsonType:'objectId'},
      level:{bsonType:'int'},
      xp:{bsonType:'int'},
      lines:{bsonType:'int'},
      best:{bsonType:'int'},
      updatedAt:{bsonType:'date'}
    }
  }});

  const attempts = await ensureCollection(db, 'attempts', { $jsonSchema:{
    bsonType:'object', required:['userId','level','testId','startedAt'],
    properties:{
      userId:{bsonType:'objectId'},
      level:{bsonType:'int'},
      testId:{bsonType:'string'},
      result:{bsonType:['string','null']},
      score:{bsonType:['int','null']},
      durationMs:{bsonType:['int','null']},
      startedAt:{bsonType:'date'},
      finishedAt:{bsonType:['date','null']}
    }
  }});

  const wallet = await ensureCollection(db, 'wallet', { $jsonSchema:{
    bsonType:'object', required:['userId','balance'],
    properties:{
      userId:{bsonType:'objectId'},
      balance:{bsonType:'int'},
      tx:{bsonType:'array', items:{
        bsonType:'object',
        required:['ts','amount','reason'],
        properties:{
          ts:{bsonType:'date'},
          amount:{bsonType:'int'},
          reason:{bsonType:'string'},
          meta:{bsonType:['object','null']}
        }
      }}
    }
  }});

  const aliases = await ensureCollection(db, 'aliases', { $jsonSchema:{
    bsonType:'object', required:['userId','alias'],
    properties:{
      userId:{bsonType:'objectId'},
      alias:{bsonType:'string'},
      isDefault:{bsonType:'bool'}
    }
  }});

  const leaderboard = await ensureCollection(db, 'leaderboard', { $jsonSchema:{
    bsonType:'object', required:['level','period','userId','score','ts'],
    properties:{
      level:{bsonType:'int'},
      period:{bsonType:'string'},
      userId:{bsonType:'objectId'},
      score:{bsonType:'int'},
      ts:{bsonType:'date'}
    }
  }});

  const events = await ensureCollection(db, 'events', { $jsonSchema:{
    bsonType:'object', required:['ts','type'],
    properties:{
      ts:{bsonType:'date'},
      type:{bsonType:'string'},
      userId:{bsonType:['objectId','null']},
      deviceId:{bsonType:['string','null']},
      sid:{bsonType:['string','null']},
      level:{bsonType:['int','null']},
      meta:{bsonType:['object','null']}
    }
  }});

  const consents = await ensureCollection(db, 'consents', { $jsonSchema:{
    bsonType:'object', required:['userId','version','acceptedAt'],
    properties:{
      userId:{bsonType:'objectId'},
      version:{bsonType:'string'},
      acceptedAt:{bsonType:'date'},
      guardian:{bsonType:['object','null']}
    }
  }});

  // --- Indexes (idempotent) ---
  await Promise.all([
    users.createIndex({ handle:1 }, { unique:true, collation:{ locale:'en', strength:2 } }),
    users.createIndex({ email:1 },  { unique:true, sparse:true, collation:{ locale:'en', strength:2 } }),
    devices.createIndex({ deviceId:1 }, { unique:true }),
    devices.createIndex({ lastSeen:-1 }),
    sessions.createIndex({ sid:1 }, { unique:true }),
    sessions.createIndex({ userId:1, lastSeen:-1 }),
    sessions.createIndex({ expiresAt:1 }, { name:'expiresAt_ttl0', expireAfterSeconds:0 }),
    classes.createIndex({ code:1 }, { unique:true }),
    classes.createIndex({ teacherId:1, active:1 }),
    enrollments.createIndex({ classId:1, userId:1 }, { unique:true }),
    buddies.createIndex({ members:1 }),
    buddies.createIndex({ status:1, createdAt:-1 }),
    parties.createIndex({ code:1 }, { unique:true }),
    levels.createIndex({ no:1 }, { unique:true }),
    progress.createIndex({ userId:1, level:1 }, { unique:true }),
    progress.createIndex({ updatedAt:-1 }),
    attempts.createIndex({ userId:1, level:1, startedAt:-1 }),
    wallet.createIndex({ userId:1 }, { unique:true }),
    aliases.createIndex({ userId:1, alias:1 }, { unique:true }),
    leaderboard.createIndex({ level:1, period:1, score:-1 }),
    events.createIndex({ ts:1 }, { name:'ts_ttl_180d', expireAfterSeconds:180*24*3600 }),
    events.createIndex({ type:1, ts:-1 }),
    events.createIndex({ userId:1, ts:-1 })
  ]);

  // --- Seed teacher + class + starter levels ---
  await users.updateOne(
    { handle: TEACHER_HANDLE },
    { $setOnInsert: { createdAt: now },
      $set: { name: TEACHER_NAME, email: TEACHER_EMAIL, roles: ['teacher','admin'] } },
    { upsert: true }
  );
  const teacher = await users.findOne({ handle: TEACHER_HANDLE });
  const teacherId = teacher?._id;

  await wallet.updateOne(
    { userId: teacherId },
    { $setOnInsert: { balance: 0, tx: [] } },
    { upsert: true }
  );
  await aliases.updateOne(
    { userId: teacherId, alias: TEACHER_HANDLE },
    { $setOnInsert: { isDefault: true } },
    { upsert: true }
  );
  await classes.updateOne(
    { code: CLASS_CODE },
    { $setOnInsert: { createdAt: now },
      $set: { name: CLASS_NAME, code: CLASS_CODE, teacherId, capacity: CLASS_CAP, active: true } },
    { upsert: true }
  );

  const seedLevels = [
    { no:0, name:'pong',  tests:101, rules:{ sfx:'pong' },       published:true },
    { no:1, name:'ping',  tests:101, rules:{ sfx:'pingpong' },   published:true },
    { no:2, name:'ding',  tests:101, rules:{ enemy:'bot1', sfx:'ding' }, published:true },
    { no:3, name:'dong',  tests:101, rules:{ enemy:'bot2', sfx:'dong' }, published:true },
    { no:4, name:'coop-ascend', tests:101, rules:{ nextOnScore:4 },       published:true }
  ];
  for (const L of seedLevels) {
    await levels.updateOne({ no: L.no }, { $set: L }, { upsert: true });
  }

  const counts = {};
  for (const n of ['users','classes','levels','sessions','events','leaderboard']) {
    counts[n] = await db.collection(n).countDocuments({});
  }
  console.log(JSON.stringify({ ok:true, db:DBN, teacherId, classCode:CLASS_CODE, counts }, null, 2));
  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
