const fs = require("fs");
const https = require("https");
const crypto = require("crypto");
const querystring = require("querystring");
const key = fs.readFileSync('./localhost/localhost.key');
const cert = fs.readFileSync('./localhost/localhost.crt');

const { client_id, client_secret, scope } = require("./auth/credentials.json");
let messageFormat = require ("./msgFormat.json");
const port = 3000;
const server = https.createServer({ key, cert });
const all_sessions = []; 
let all_request = [];
const state = crypto.randomBytes(20).toString("hex");
let timestamp = 0;
let flag = true;


server.on("listening", listen_handler);
server.listen(port);
function listen_handler() {
    console.log(`Listening on port ${port}`);
}

server.on("request", request_handler);
function request_handler(req, res) {
    console.log(`New request from  ${req.socket.remoteAddress}  for ${req.url}`);
    if (req.url === "/") {
        
        const form = fs.createReadStream("html/index.html");
        res.writeHead(200, { "Content-Type": "text/html" })
        form.pipe(res);
       
    }
   else if (req.url === "/index.css") {
        
        const form = fs.createReadStream("html/index.css");
        res.writeHead(200, { "Content-Type": "text/css" })
        form.pipe(res);
       
    }
    else if (req.url.startsWith("/download_messages")) {
        // console.log(req.url)
        const user_input = new URL(req.url, `https://${req.headers.host}`).searchParams;
        const channelID = user_input.get("channelID");
        const nr = user_input.get("nr");
        const fileName = user_input.get("fileName");


        if (channelID == null || channelID === "" || nr == null || nr === "") {
            not_found(res);
            return;
        }
        if (Number.isNaN(Number(nr))) {
            input_error(res);
        }
        all_sessions.push({ channelID, nr, fileName, state });

        redirect_to_slack(state, res);
    }
    else if (req.url.startsWith("/receive_code")) {

        const user_input = new URL(req.url, `https://${req.headers.host}`).searchParams;
        const code = user_input.get("code");
        const state = user_input.get("state");

        let session = all_sessions.find((session) => session.state === state);
        if (code === undefined || state === undefined || session === undefined) {
            not_found(res);
            return;
        }
        const { channelID, fileName, nr } = session;
        send_access_token_request_slack(code, { channelID, fileName, nr }, res);

    }
    else if (req.url.startsWith("/redirect2")) {

        const user_input = new URL(req.url, `https://${req.headers.host}`).searchParams

        const code = user_input.get("code");
        const state = user_input.get("state");

        let session = all_sessions.find((session) => session.state === state);
        if (code === undefined || state === undefined) {
            not_found(res);
            return;
        }
        const { channelID, nr, fileName } = session;
        if (flag === true) {
            send_access_token_request_drive(code, { channelID, nr, fileName }, res);
        }
        else if (flag === false) {
            const query = all_request[0];
            send_access_token_request_drive2(code, query, res)
            all_request = [];
        }


    }
    else if (req.url.startsWith("/question")) {
        // console.log(req.url)
        const user_answer = new URL(req.url, `https://${req.headers.host}`).searchParams;
        const answer1 = user_answer.get("answer1");
        const answer2 = user_answer.get("answer2");
        const answer3 = user_answer.get("answer3")
        if (answer1 === "yes") {
            flag = false;
            writeQuery(res);
        }
        else if (answer2 === "no") {
            flag = true;
            returnToHome(res);
        }
        else if (answer3 === "ney") {
            flag = true;
           resultPage(res);
        }
    }
    else if (req.url === "/quest.css") {
        
        const form = fs.createReadStream("html/quest.css");
        res.writeHead(200, { "Content-Type": "text/css" })
        form.pipe(res);
       
    }
    else if (req.url.startsWith("/result")) {
        // console.log(req.url)
        const user_answer = new URL(req.url, `https://${req.headers.host}`).searchParams;
        const answer1 = user_answer.get("answer1");
        const answer2 = user_answer.get("answer2");
        if (answer1 === "yes") {
            flag = false;
            writeQuery(res);
        }
        else if (answer2 === "no") {
            flag = true;
            returnToHome(res);
        }
      
    }else if (req.url === "/res.css") {
        
        const form = fs.createReadStream("html/res.css");
        res.writeHead(200, { "Content-Type": "text/css" })
        form.pipe(res);
       
    }
    else if (req.url.startsWith("/write_a_query")) {
        // console.log(req.url)
        let body = "";
        req.on('data', function (chunk) {
            body += chunk;
        });
        req.on("end", function () {
            let requestBody = querystring.parse(body);

            console.log(`Query entered: ${requestBody.query}`);
            all_request.push(requestBody.query);
            redirect_to_drive(state, res)
        });

    }
    else if (req.url === "/query.css") {
        
        const form = fs.createReadStream("html/query.css");
        res.writeHead(200, { "Content-Type": "text/css" })
        form.pipe(res);
       
    }
    else {
        not_found(res);
    }

}

function not_found(res) {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end(`<h1>404 Not Found</h1>`);
}


function redirect_to_slack(state, res) {
    const authorization_endpoint = "https://slack.com/oauth/v2/authorize";
    let uri = new URLSearchParams({ scope, client_id, state }).toString();

    res.writeHead(302, { Location: `${authorization_endpoint}?${uri}` })
        .end(console.log("Redirecting to Slack..."));

}

function redirect_to_drive(state, res) {
    console.log(flag);
    if (flag === true) {
        let { client_id, scope, redirect_uri, response_type } = require("./auth/credentials2.json");

        const authorization_endpoint = "https://accounts.google.com/o/oauth2/v2/auth";

        let uri = new URLSearchParams({ client_id, redirect_uri, response_type, scope, state }).toString();
        res.writeHead(302, { Location: `${authorization_endpoint}?${uri}` })
            .end(console.log("Redirecting to Google..."));
    }
    else if (flag === false) {
        let { client_id, scope, redirect_uri, response_type } = require("./auth/credentials3.json");
        const authorization_endpoint = "https://accounts.google.com/o/oauth2/v2/auth";

        let uri = new URLSearchParams({ client_id, redirect_uri, response_type, scope, state }).toString();
        res.writeHead(302, { Location: `${authorization_endpoint}?${uri}` })
            .end(console.log("Redirecting to Google(Query)..."));
    }

}

function send_access_token_request_slack(code, user_input, res, state) {

    const token_endpoint = "https://slack.com/api/oauth.v2.access";
    let post_data = new URLSearchParams({ client_id, client_secret, code }).toString();

    let options = {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        }
    }
    https.request(
        token_endpoint,
        options,
        (token_stream) => process_stream(token_stream, receive_access_token, user_input, res)
    ).end(post_data, console.log("Sent Request for Slack Token"));


}

function send_access_token_request_drive(code, user_input, res) {

    const { client_id, client_secret, scope, redirect_uri, response_type, grant_type } = require("./auth/credentials2.json");
    const token_endpoint = "https://oauth2.googleapis.com/token";
    let post_data = new URLSearchParams({ client_id, client_secret, redirect_uri, grant_type, code }).toString();

    let options = {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",

        }
    }
    https.request(
        token_endpoint,
        options,
        (token_stream) => process_stream(token_stream, receive_access_token_drive, user_input, res)
    ).end(post_data, console.log("Sent Request for Google Token"));
}
function send_access_token_request_drive2(code, query, res) {

    const { client_id, client_secret, scope, redirect_uri, response_type, grant_type } = require("./auth/credentials2.json");
    const token_endpoint = "https://oauth2.googleapis.com/token";
    let post_data = new URLSearchParams({ client_id, client_secret, redirect_uri, grant_type, code }).toString();

    let options = {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",

        }
    }
    https.request(
        token_endpoint,
        options,
        (token_stream) => process_stream(token_stream, receive_access_token_drive, query, res)
    ).end(post_data, console.log("Sent Request for Query Token"));
}


function process_stream(stream, callback, ...args) {
    let body = "";
    stream.on("data", (chunk) => (body += chunk));
    stream.on("end", () => callback(body, ...args));
    //console.log(body);
}

function receive_access_token(body, user_input, res) {

    const { access_token } = JSON.parse(body);
    if (access_token !== undefined) {
        console.log("Token for Slack Received!")
    }
    get_messages(user_input, access_token, res);

}
function receive_access_token_drive(body, user_input, res) {

    const { access_token } = JSON.parse(body);
    if (access_token !== undefined) {
        console.log("Token for Google Received!")
    }
    if (flag === true) {
        send_to_drive(access_token, user_input, res);
    }
    else if (flag === false) {

        send_a_query(access_token, user_input, res)
    }

}
function send_to_drive(access_token, user_input, res) {
    const { fileName } = user_input;
    // console.log(`table name${fileName}`)
    const { scope, key } = require("./auth/credentials2.json");
    const drive_endpoint = `https://bigquery.googleapis.com/bigquery/v2/projects/groovy-treat-386301/datasets/pr355/tables/${fileName}/insertAll?key=${key}`;



    const body = JSON.stringify({ "rows": messageFormat });
    messageFormat = [];
    const options = {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${access_token}`,
            "scope": `${scope}`,
            "Accept": "application/json",
            "Content-Type": "application/json",

        }

    }

    https.request(
        drive_endpoint,
        options,
        (res, err) => {
            console.log(res.statusCode)
            if (res.statusCode === 200) {
                console.log(`Authentication with Google Successful "\n"Data sent to DB!`)
            }
        }
    ).end(body, askQouestion(res))

}

function send_a_query(access_token, user_input, res) {
    const { scope, key } = require("./auth/credentials3.json");
    const drive_endpoint = `https://bigquery.googleapis.com/bigquery/v2/projects/groovy-treat-386301/queries?key=${key}`;

   // console.log(user_input);
    const body = JSON.stringify({ "query": `${user_input}` });
    messageFormat = [];
    const options = {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${access_token}`,
            "scope": `${scope}`,
            "Accept": "application/json",
            "Content-Type": "application/json",

        }

    }

    https.request(
        drive_endpoint,
        options,
        (token_stream) => process_stream(token_stream, show_result, res)

    ).end(body ,askQouestion(res))

}

function returnToHome(res) {
    fs.createReadStream("./html/index.html").pipe(res)
}

function askQouestion(res) {
    fs.createReadStream("./html/question.html").pipe(res)
}

function writeQuery(res) {
    fs.createReadStream("./html/query.html").pipe(res)
}
function resultPage(res) {
    fs.createReadStream("./html/result.html").pipe(res)
}


function get_messages(user_input, access_token, res) {
    let messages_endpoint = "";
    const { channelID, nr } = user_input;
    if (nr === "all") {
        messages_endpoint = `https://slack.com/api/conversations.history?channel=${channelID}&limit=10000&pretty=1`;
    }
    else {
        messages_endpoint = `https://slack.com/api/conversations.history?channel=${channelID}&limit=${nr}&pretty=1`;
    }


    const my_request = https.request(messages_endpoint,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${access_token}`,
                "sub": null
            }
        })

    my_request.on("response", (stream) => process_stream(stream, receive_message_results, user_input, access_token, res));
    my_request.end(console.log("Authentication with Slack Successful!"));


}
function show_result(body, res) {
    let  results = JSON.parse(body);
        //  console.log("query items :" + results.rows.length)
        //   console.log(results.schema.fields[0].name+"  |  "+results.schema.fields[1].name+"  | "+results.schema.fields[2].name);
    //  if(res.statusCode===200){


    //  }
     //console.log(`result ${body}`)
    //  results.rows.forEach(msg => {
    //     console.log(msg.f[0]?.v +"|"+ msg.f[1]?.v+"|"+ msg.f[2]?.v)
    // })
    //console.log(res.statusCode)
    flag = true;
    //  if(body.error === undefined){
    //   renderHTML(results,res);
        
    //  }
    //  else if (body.error.code === 400){
    //     renderHTML2(res); 
    //  }
    renderHTML(results,res);
       
}
function receive_message_results(body, user_input, access_token, res) {
    const instream = fs.createWriteStream("./myfile.txt");
    let counter = 0;
    //console.log(messageFormat);
    const message_object = JSON.parse(body);
    //  console.log(message_object.messages);
    message_object.messages.reverse().forEach(msg => {

        let jsonInstance = {
            "insertId": "ts",
            "json": {
                "ts": msg.ts,
                "user": `${msg.user}`,
                "text": `${msg.text}`
            }
        }
        instream.write(msg.user + " on " + msg.ts + " " + msg.text + "\n");
        if (msg.ts > timestamp) {
            timestamp = msg.ts;
            messageFormat[counter] = jsonInstance;
            counter++;
        }

    });
    // console.log( msgpatterns);
    instream.end(console.log(`${counter} Messages Retrived!`), redirect_to_drive(state, res)); //synchronization here!!!!
}

   
function renderHTML(results, res) {
    let instream2 = fs.createWriteStream("./html/result.html")
    res.writeHead(200, { 'Content-Type': 'text/html' });

    instream2.write(`<!DOCTYPE html> \n <html>\n <head> \n
    
     <meta charset="UTF-8" />\n
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n
     <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet"
         integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">\n
     <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js"
         integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM"
         crossorigin="anonymous"></script>\n

         <link  rel="stylesheet" type="text/css" href="./res.css"/>\n
         </head>\n
         <body>\n
         <div id="all">\n

         <form action="result" method="get">\n
 
             <div id="row" class="row">\n
 
                 <div id="tap1" class="col-lg-6 col-sm-12">\n
                     <div id="label1"><label for="yes">Query</label></div>\n
                     <input type="radio" id="answer1" name="answer1" value="yes" />\n
                 </div>\n
 
                 <div id="tap2" class="col-lg-6   col-sm-12">\n
                     <div id="label2"><label for="no">Home</label></div>\n
                     <input type="radio" id="answer2" name="answer2" value="no" /> \n
                 </div>\n
 
             </div>\n
 
             <input type="submit" value="GO" />\n
 
         </form>\n
 
     </div>\n
		<div>\n
			<H3>Query Results:${results.rows.length}<H3>\n
		</div>\n
       
        <ol id="list"  style="display: flex; flex-direction: column; text-align:center ;">
        `)
        let text=""
        results.rows.forEach(msg => {
            if(msg.f[2]!==undefined){
                  text = JSON.stringify(msg.f[2]?.v).replace(/[<>]/g, ' ');
            }
        instream2.write(`<li id="li">${msg.f[0]?.v} | ${msg.f[1]?.v} | ${text}</li> \n`);
    });
    instream2.write(` 
  </ol> \n  </body> \n </html>`);
    instream2.end(console.log("Query Results Ready"));

}
function renderHTML2( res) {
    let instream2 = fs.createWriteStream("./html/result.html")
    res.writeHead(200, { 'Content-Type': 'text/html' });

    instream2.write(`<!DOCTYPE html> \n <html>\n <head> \n
    
     <meta charset="UTF-8" />\n
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n
     <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet"
         integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">\n
     <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js"
         integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM"
         crossorigin="anonymous"></script>\n

         <link  rel="stylesheet" type="text/css" href="./res.css"/>\n
         </head>\n
         <body>\n
         <div id="all">\n

         <form action="result" method="get">\n
 
             <div id="row" class="row">\n
 
                 <div id="tap1" class="col-lg-6 col-sm-12">\n
                     <div id="label1"><label for="yes">Query</label></div>\n
                     <input type="radio" id="answer1" name="answer1" value="yes" />\n
                 </div>\n
 
                 <div id="tap2" class="col-lg-6   col-sm-12">\n
                     <div id="label2"><label for="no">Home</label></div>\n
                     <input type="radio" id="answer2" name="answer2" value="no" /> \n
                 </div>\n
 
             </div>\n
 
             <input type="submit" value="GO" />\n
 
         </form>\n
 
     </div>\n
		<div>\n
			<H3>Query Results:0<H3>\n
		</div>\n
       
        <ol id="list"  style="display: flex; flex-direction: column; text-align:center ;">
        `)
       
        instream2.write(`<li id="li"> Issues with query!</li> \n`);
   
    instream2.write(` 
  </ol> \n  </body> \n </html>`);
    instream2.end(console.log("Query Results Ready"));

}
