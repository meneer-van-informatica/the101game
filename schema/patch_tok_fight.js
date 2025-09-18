const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbn = process.env.MONGODB_DB  || 'the101game';
(async()=>{
  const c = new MongoClient(uri); await c.connect(); const d=c.db(dbn);

  async function ensure(name, schema) {
    const ex = await d.listCollections({name}).hasNext();
    if (!ex) await d.createCollection(name, schema?{validator:{$jsonSchema:schema}}:{});
    return d.collection(name);
  }

  const toks = await ensure('toks', {bsonType:'object', required:['code','type','from','status','createdAt'],
    properties:{
      code:{bsonType:'string'},                  // short id
      type:{bsonType:'string'},                  // 'invite' | 'fight'
      from:{bsonType:'object'},                  // {userId?, alias?}
      to:{bsonType:['object','null']},           // {alias?} (optioneel)
      status:{bsonType:'string'},                // sent | accepted | expired | canceled
      createdAt:{bsonType:'date'},
      expiresAt:{bsonType:['date','null']},
      meta:{bsonType:['object','null']}
    }
  });
  await Promise.all([
    toks.createIndex({code:1},{unique:true}),
    toks.createIndex({status:1, createdAt:-1}),
    toks.createIndex({'to.alias':1, status:1, createdAt:-1})
  ]);

  const fights = await ensure('fights', {bsonType:'object', required:['code','state','createdAt'],
    properties:{
      code:{bsonType:'string'},                  // match code (gedeeld met tok)
      state:{bsonType:'string'},                 // waiting | live | done
      levelSet:{bsonType:['string','null']},     // bv '101'
      members:{bsonType:'array', items:{bsonType:'object'}}, // [{userId?, alias, joinedAt}]
      score:{bsonType:'object'},                 // {aliasOrId: int}
      createdAt:{bsonType:'date'},
      startedAt:{bsonType:['date','null']},
      finishedAt:{bsonType:['date','null']},
      kukelAwarded:{bsonType:'bool'}
    }
  });
  await Promise.all([
    fights.createIndex({code:1},{unique:true}),
    fights.createIndex({state:1, createdAt:-1})
  ]);

  // events & wallet bestaan al in je schema; no-op hier.

  const counts = {
    toks: await d.collection('toks').countDocuments({}),
    fights: await d.collection('fights').countDocuments({})
  };
  console.log(JSON.stringify({ok:true,db:dbn,counts}, null, 2));
  await c.close();
})().catch(e=>{console.error(e);process.exit(1);});
