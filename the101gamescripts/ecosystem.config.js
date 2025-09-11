module.exports = {
  apps: [{
    name: "flask-app",
    script: "the101gameengine/app.py",
    interpreter: "/var/www/venv/bin/python",
    cwd: "/var/www",
    env: {
      PORT: "3000",
      STATIC_DIR: "/var/www/the101gamestatic",
      ENGINE_DB: "sqlite:////var/www/the101gameengine/engine.db",
      SECRET_KEY: "change-me"
    },
    autorestart: true,
    max_restarts: 10
  }]
}
