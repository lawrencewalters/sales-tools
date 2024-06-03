const http = require('http');

const server = http.createServer((req, res) => {
  // Set the response content type to plain text
  res.setHeader('Content-Type', 'text/plain');

  // Print the request headers to the console
  console.log('Request Headers:');
  console.log(JSON.stringify(req.rawHeaders));
  // for (const [key, value] of Object.entries(req.headers)) {
  //   console.log(`${key}: ${value}`);
  // }
  console.log('...');

  // Send a response to the client
  res.end('Request headers printed in the console.');
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
  console.log('...');
});
