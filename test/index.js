const crypto = require("crypto");
(async () => {
  const requestsData = [];
  for (let req = 0; req < parseInt(process.env.REQUESTS||5); req++) requestsData.push(crypto.randomUUID().replace(/\-/gi, "").slice(0, 23));
  if (process.env.TYPEREQUEST === "MULTIPLE") requestsData.map(a => (require("./users/v1")).main(a).then(a => console.log(a)));
  else for (const data of requestsData) await (require("./users/v1")).main(data).then(a => console.log(a));
})();