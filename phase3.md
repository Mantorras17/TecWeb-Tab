<h1>THIRD PHASE</h1>

The objective of this last phase is to develop a server in Node, replicating and replacing the server used in phase two.


<h2>Requests</h2>

The server will have to implement the functions with the arguments defined in the section [requests](./phase2.md) from the previous phase.

The server must verify that all arguments required for each function have been sent. It also has to verify that the arguments have the right typage and are in the allowed intervals.


<h2>Responses</h2>

The responses of those functions must also follow the specifications of the section [responses](./phase2.md) from the previous phase.

The server must produce state response lines appropriate, like:
  - 200: successful request
  - 400: requests error (ex:. argument validation)
  - 401: non-authorized request (invalid pair nick/password)
  - 404: unknown request


<h2>Structure</h2>

The server must be strucured in modules. 

The main file, that loads the others, defines the function of request processing and initiates it's listening, must be called `index.js`.


<h2>Persistence</h2>

The application data, propperly serialized in JSON, will be persisted in files using the module `fs` (file system).

In a real app, the data would be persisted in a database. Keeping in mind the data's nature, NoSQL (like Redis) would be used. But could also be SQL (like MySQL or MariaDB).

Node.js has modules for connecting to both types of databases, but we are not going to use them for this assignment.


<h2>Hash and cyphers</h2>

The game identifyer (`game`) must be generated from the configurations that generates it, including time. The easiest way is to use the module crypto to create a hash MD5 of a value and encode it in hexadecimal.
```
const crypto = require('crypto');
const hash = crypto.createHash('md5').update('value').digest('hex');
```
For security reasons, passwords must be cyphered before being saved and the API crypto should be used for that purpose.


<h2>Server</h2>

The development of the server can be made on our local machine but the stable versions should be published online.

Our server should be posted at `twserver.alunos.dcc.fc.up.pt` at port `81XX` where XX is the number of our group.

- The server will be stored in the backend of twserver
- In which we can access through ssh to execute commands
- In which we can copy files to our local machines


  - Back-end:

	For safety reasons the server on the web is called `twserver-be` and must be accessed through a jump server called `ssh.alunos.dcc.fc.up.pt`.

	Each student has an ssh account on twserver-be and on the jump server, being the authentication data the LDAP of LabCC.


  - Shell access:

	To initiate a session with a command shell on twserver-be, the student must execute the following:
	```
	ssh -J up999999999@ssh.alunos.dcc.fc.up.pt up999999999@twserver-be
	```
	Note that after you will have to authenticate 2 times, one on jump server and one on twserver-be.

  - Copy files:

	You can copy files securely using scp (secure copy).

	To copy all the files of the current directory to the folder directory (for example) on twserver-be, the student has to execute:
	```
	scp -J up999999999@ssh.alunos.dcc.fc.up.pt * up999999999@twserver-be:pasta
	```
	Note that after you will have to authenticate 2 times, one on jump server and one on twserver-be.


<h2>Minimums and valorization</h2>

The minimum objective is the implementation of the functions:
- register
- ranking

The rest of the functions (join, leave, notify, update) are considered valorization to get the full marks and should be implemented after the previous.

It will be particularly valued the integration of the previous phase with the Node.js server, developed and installed in the twserver.


<h2>Submission</h2>

The ZIP archive for the submission should only contain the various modules on the server, as well as the root file index.js

It must also include the file index.html, as well as the js and css files referent to the interface. The client js files must be configured to communicate with the group's Node.js server installed in the twserver.

Note also that previous work done in previous deliveries will not be re-evaluated.