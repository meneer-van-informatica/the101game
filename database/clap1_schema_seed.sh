#!/usr/bin/env bash
set -euo pipefail
: "${THE101_URI:?THE101_URI niet gezet}"
if command -v mongosh >/dev/null 2>&1; then MS=(mongosh --quiet "$THE101_URI"); else MS=(mongo --quiet "$THE101_URI"); fi
"${MS[@]}" <<'JS'
db.createCollection("aliases", { capped: false }).catch(()=>{});
db.createCollection("kukel_events", { capped: false }).catch(()=>{});
db.createCollection("pancakes", { capped: false }).catch(()=>{});

db.aliases.createIndex({ alias:1 }, { unique:true, name:"alias_unique" });
db.kukel_events.createIndex({ alias:1, at:-1 });
db.pancakes.createIndex({ alias:1, at:-1 });

db.aliases.updateOne(
  { alias:"lmw" },
  { $setOnInsert:{ alias:"lmw", kukel:0, createdAt:new Date() }, $set:{ lastSeenAt:new Date() } },
  { upsert:true }
);
db.kukel_events.insertOne({ alias:"lmw", delta:+1, at:new Date(), reason:"seed" });
db.pancakes.insertOne({ alias:"lmw", kind:"stack_init", at:new Date(), note:"seed" });
print("Skelet + dummy klaar.");
JS
