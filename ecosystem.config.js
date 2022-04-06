module.exports = {
  apps : [{
    script: "dist/index.js",
    watch: ".",
    exec_mode: "cluster",
    instances: "max",
    name: "daemon-maneger"
  }]
};
