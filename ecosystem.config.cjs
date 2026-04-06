module.exports = {
    apps: [
        {
            name: "pvp-server",
            cwd: ".",
            script: "packages/server/dist/index.js",
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: "development",
                PORT: "2567",
                CLIENT_ORIGIN: "http://localhost:5173"
            },
            env_production: {
                NODE_ENV: "production",
                PORT: "2567",
                CLIENT_ORIGIN: "https://main.d2o2g054ighqrb.amplifyapp.com/"
            }
        }
    ]
}